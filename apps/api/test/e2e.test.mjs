// End-to-end API tests — node:test + fetch. Self-contained:
// boots a fresh seeded SQLite DB + the built API, runs assertions, tears down.
// Run:  npm run build && node --test test/e2e.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execSync } from 'node:child_process';

const PORT = 3011;
const API = `http://localhost:${PORT}/api`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ENV = {
  ...process.env,
  DATABASE_URL: 'file:./test-e2e.db',
  PORT: String(PORT),
  JWT_SECRET: 'test-jwt-secret',
  PLATFORM_JWT_SECRET: 'test-platform-secret',
  PLATFORM_ADMIN_EMAIL: 'admin@test.local',
  PLATFORM_ADMIN_PASSWORD: 'admin123',
  RAZORPAY_WEBHOOK_SECRET: 'whsec_test',
  SEED_ON_BOOT: 'false',
  CORS_ORIGIN: '*',
};

let proc;

async function api(path, opts = {}) {
  const res = await fetch(API + path, opts);
  let body = null;
  try { body = await res.json(); } catch {}
  return { status: res.status, body };
}
const auth = (t) => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' });

before(async () => {
  // fresh DB + seed (demo shop + platform admin + plans)
  execSync('npx prisma db push --force-reset --skip-generate', { env: ENV, stdio: 'ignore' });
  execSync('npx ts-node --transpile-only prisma/seed.ts', { env: ENV, stdio: 'ignore' });
  execSync('npx ts-node --transpile-only prisma/seed-saas.ts', { env: ENV, stdio: 'ignore' });
  proc = spawn('node', ['dist/src/main.js'], { env: ENV, stdio: 'ignore' });
  // wait for health
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(API + '/health'); if (r.ok) return; } catch {}
    await sleep(400);
  }
  throw new Error('API did not start');
});

after(() => { try { proc?.kill('SIGKILL'); } catch {} });

test('health endpoint reports DB up', async () => {
  const { status, body } = await api('/health');
  assert.equal(status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.db, 'up');
});

test('shop owner can log in', async () => {
  const { status, body } = await api('/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@demo.com', password: 'demo1234' }),
  });
  assert.equal(status, 201);
  assert.ok(body.accessToken, 'token returned');
});

test('public plans are listed', async () => {
  const { status, body } = await api('/auth/plans');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body) && body.length >= 4, '4 plans');
});

test('self-serve signup creates a Trial tenant + logs in', async () => {
  const email = `sue${Date.now()}@shop.com`;
  const { status, body } = await api('/auth/signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shopName: 'Signup Test', ownerName: 'Sue', ownerEmail: email, password: 'pass123' }),
  });
  assert.equal(status, 201);
  assert.ok(body.accessToken, 'logged in');
  assert.ok(body.subdomain, 'subdomain assigned');
  assert.equal(body.trialEndsAt ? 'trial' : 'none', 'trial');
});

test('platform admin login works; control plane rejects no token', async () => {
  const login = await api('/admin/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@test.local', password: 'admin123' }),
  });
  assert.equal(login.status, 201);
  assert.ok(login.body.accessToken);
  // guard: no token => 401
  const noToken = await api('/admin/tenants');
  assert.equal(noToken.status, 401);
  // with token => metrics
  const m = await api('/admin/metrics', { headers: auth(login.body.accessToken) });
  assert.equal(m.status, 200);
  assert.equal(typeof m.body.mrr, 'number');
});

test('TENANT ISOLATION: Shop A cannot read Shop B order', async () => {
  // create two shops
  const mk = async (n) => {
    const r = await api('/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopName: `Iso${n}${Date.now()}`, ownerName: n, ownerEmail: `iso${n}${Date.now()}@x.com`, password: 'pass123' }),
    });
    return r.body.accessToken;
  };
  const tokenA = await mk('A');
  const tokenB = await mk('B');

  // B makes a real menu item + order
  const cats = await api('/menu/categories', { headers: auth(tokenB) });
  const catId = cats.body[0].id;
  const item = await api('/menu/items', { method: 'POST', headers: auth(tokenB), body: JSON.stringify({ categoryId: catId, name: 'B Dish', basePrice: 100 }) });
  const order = await api('/orders', { method: 'POST', headers: auth(tokenB), body: JSON.stringify({ orderType: 'TAKEAWAY', items: [{ menuItemId: item.body.id, name: 'B Dish', quantity: 1, unitPrice: 100 }] }) });
  const orderId = order.body.id;
  assert.ok(orderId, 'B order created');

  // control: B reads own order => 200
  const bRead = await api('/orders/' + orderId, { headers: auth(tokenB) });
  assert.equal(bRead.status, 200);

  // attack: A reads B order => 404
  const aRead = await api('/orders/' + orderId, { headers: auth(tokenA) });
  assert.equal(aRead.status, 404, 'cross-tenant read blocked');

  // attack: A pays B order => 400/404
  const aPay = await api('/payments/orders/' + orderId + '/pay', { method: 'POST', headers: auth(tokenA), body: JSON.stringify({ payments: [{ method: 'CASH', amount: 100 }] }) });
  assert.ok([400, 404].includes(aPay.status), 'cross-tenant pay blocked');
});

test('billing webhook rejects an unsigned request', async () => {
  const { status } = await api('/webhooks/razorpay', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'subscription.charged' }),
  });
  assert.equal(status, 401, 'unsigned webhook rejected');
});
