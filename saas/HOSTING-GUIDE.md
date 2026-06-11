# RestroGenie Cloud — Hosting Guide

My recommended path for a **solo founder**: cheapest to start, near-zero DevOps, scales
automatically as you add paying shops. You asked me to pick — here it is, with the
trade-offs and exact steps.

---

## TL;DR — Recommended stack (managed)

| Layer | Service | Free tier? | Paid starts at | Why |
|-------|---------|:---------:|----------------|-----|
| Database + Auth + Storage | **Supabase** | ✅ generous | ~$25/mo (Pro) | Managed Postgres, built-in auth, **Row-Level Security** = perfect for multi-tenant isolation |
| API (NestJS) | **Render** (or Railway) | ✅ (sleeps) | $7/mo | Push-to-deploy, easy env vars, no server admin |
| POS frontend (Next.js) | **Vercel** | ✅ | $20/mo Pro | Best-in-class for Next.js, instant global CDN |
| Super-admin (Next.js) | **Vercel** (2nd project) | ✅ | — | Separate deploy, separate domain |
| Payments | **Razorpay** | ✅ (no monthly) | 2% per txn | India: UPI-autopay, cards, recurring **Subscriptions** |
| Domain + DNS + wildcard subdomains | **Cloudflare** | ✅ | ~₹900/yr (domain) | Free SSL, wildcard `*.yourpos.app`, CDN, DDoS |
| Transactional email | **Resend** or **Brevo** | ✅ | — | Welcome + invoice + dunning emails |
| Error/uptime monitoring | **Sentry** + **BetterStack** | ✅ | — | Catch crashes, get paged on downtime |

**Cost to launch (before you have customers): ₹0 – ₹1,500/mo.**
At ~50 paying shops you'll be around **₹4,000–6,000/mo** of infra while collecting
₹30,000–80,000/mo in subscriptions. Healthy margins.

---

## Why this over a VPS

| | Managed (recommended) | Single VPS (Hostinger/DigitalOcean) |
|--|----------------------|-------------------------------------|
| Setup time | Hours | Days |
| You manage SSL/backups/uptime | ❌ (they do) | ✅ (you do) |
| Cost at start | ~₹0 | ~₹400–800/mo |
| Cost at scale | Higher per unit | Cheaper per unit |
| Risk if it breaks at 9pm Saturday | Low | It's on you |

**Verdict:** Start managed. Move the API/DB to a VPS *later* only if infra cost becomes a
real % of revenue (usually 500+ shops). Don't pre-optimize.

> Want the cheap VPS path anyway? One Hostinger KVM2 (~₹400/mo) running
> `docker compose` (Postgres + NestJS + Next.js) behind **Caddy** (auto-SSL, wildcard).
> Your existing `docker-compose.yml` is 80% there. Trade-off: you own backups & uptime.

---

## Step-by-step deploy (managed path)

### 1. Database — Supabase
1. Create a project at supabase.com → copy `DATABASE_URL` + `DIRECT_URL`.
2. In `apps/api/prisma/schema.prisma` set `provider = "postgresql"` (you switched it to
   SQLite for local; production = Postgres) and run `npx prisma migrate deploy`.
3. Enable **Row-Level Security** on every tenant table and add the policy:
   ```sql
   alter table "Order" enable row level security;
   create policy tenant_isolation on "Order"
     using (tenant_id = current_setting('app.tenant_id', true));
   ```
4. Turn on **daily backups** (Pro plan) — your customers' sales data is sacred.

### 2. API — Render
1. New → Web Service → connect your GitHub repo → root `apps/api`.
2. Build: `npm install && npx prisma generate && npm run build`
   Start: `node dist/src/main.js`
3. Add env vars: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `RAZORPAY_KEY_ID`,
   `RAZORPAY_KEY_SECRET`, `CORS_ORIGIN=https://*.yourpos.app`.
4. Note the URL, e.g. `https://restrogenic-api.onrender.com`.

### 3. POS frontend — Vercel
1. New Project → root `apps/web`.
2. Env: `NEXT_PUBLIC_API_URL=https://restrogenic-api.onrender.com`.
3. Deploy. Add your domain (next step).

### 4. Domain + wildcard subdomains — Cloudflare
1. Buy a domain (e.g. `yourpos.app`) — Cloudflare Registrar (~₹900/yr, at-cost).
2. DNS:
   - `app.yourpos.app` → CNAME → Vercel (the marketing/login site)
   - `*.yourpos.app` → CNAME → Vercel (wildcard → every shop's subdomain)
   - `admin.yourpos.app` → CNAME → the admin Vercel project
   - `api.yourpos.app` → CNAME → Render API
3. In Vercel, add `*.yourpos.app` as a domain (wildcard) — SSL is automatic.
4. In Next.js middleware, read `host`, extract the subdomain, resolve `tenantId`.

### 5. Super-admin panel — Vercel (2nd project)
- Productionize `saas/super-admin.html` into `apps/admin` (Next.js) calling
  `api.yourpos.app/admin/*`. Deploy to `admin.yourpos.app`. Lock it behind
  platform-admin auth + IP allowlist + 2FA.

### 6. Payments — Razorpay
1. Razorpay dashboard → create **Plans** mirroring Starter/Pro/Premium.
2. On tenant activation, create a **Subscription**; Razorpay handles monthly charges.
3. Add a webhook → `api.yourpos.app/webhooks/razorpay` for
   `subscription.charged` / `subscription.halted` → update `Subscription`/`Invoice`.

### 7. Email + monitoring
- Resend/Brevo API key → send welcome, invoice, payment-failed emails.
- Sentry DSN in API + web. BetterStack uptime monitor on `api.yourpos.app/health`.

---

## Security & compliance checklist (do before first paying customer)

- [ ] RLS enabled on **every** tenant table (test: log in as Shop A, try to fetch Shop B's order id → must 404)
- [ ] Daily automated DB backups + test a restore once
- [ ] HTTPS everywhere (automatic with Vercel/Cloudflare)
- [ ] Secrets in env vars, never in git (`.env` is git-ignored — keep it that way)
- [ ] Rate limiting on auth endpoints (NestJS `ThrottlerModule` — already in your app)
- [ ] PII: store only what you need; have a privacy policy & data-deletion process
- [ ] GST: your **own** invoices to shops need your GSTIN; shops' invoices to customers carry theirs
- [ ] Razorpay PCI: never store card data — Razorpay handles it
- [ ] A "export my data" + "delete my account" path (trust + future DPDP Act compliance in India)

---

## Going live — minimal viable infra

You can launch with just: **Supabase (free) + Render (free) + Vercel (free) +
Razorpay + a ₹900 domain.** Upgrade tiers only when usage or uptime needs demand it.
Add a `/health` endpoint, a status page, and a backup you've actually test-restored —
then start onboarding shops.
