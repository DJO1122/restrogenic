# RestroGenie — Lightsail Deploy Kit

Run the whole SaaS (Postgres + NestJS API + Next.js web + Caddy auto-SSL) on **one AWS
Lightsail box** for ~₹1,100/mo. This is the "best + cheapest in budget" path.

## What's in here
| File | Purpose |
|------|---------|
| `docker-compose.prod.yml` | The full stack: `postgres` + `api` + `web` + `caddy` |
| `Caddyfile` | Reverse proxy + automatic HTTPS (and wildcard subdomain notes) |
| `.env.prod.example` | Copy to `.env.prod`, fill in domain + secrets |
| `deploy-lightsail.sh` | One-shot installer (Docker → clone → build → up) |

Plus, in the app: `apps/api/docker-entrypoint.sh` auto-switches Prisma to **PostgreSQL**,
runs migrations, and (first boot) seeds the platform admin + plans.

---

## Step-by-step (15 minutes)

### 1. Create the Lightsail instance
- AWS Console → **Lightsail → Create instance**
- Region **Mumbai (ap-south-1)**, **Linux → Ubuntu 22.04**
- Plan: **$10/mo** (2 GB RAM / 2 vCPU / 60 GB SSD) — enough for the first dozens of shops
- Create a **Static IP** and attach it to the instance
- Networking → open ports **80** and **443** (TCP) in the firewall

### 2. Point your domain at the box
In your DNS (Route 53 or Cloudflare), add **A records** → the static IP:
```
restrogenic.shop        A   <STATIC_IP>
www.restrogenic.shop    A   <STATIC_IP>
api.restrogenic.shop    A   <STATIC_IP>
*.restrogenic.shop      A   <STATIC_IP>   # for shop subdomains
```

### 3. Deploy
SSH into the box (Lightsail browser terminal or your key), then:
```bash
# point the script at your repo first (edit REPO_URL), or clone manually:
git clone https://github.com/YOU/restrogenic.git ~/restrogenic
bash ~/restrogenic/deploy/deploy-lightsail.sh
# → it creates deploy/.env.prod with auto-generated secrets and stops.

nano ~/restrogenic/deploy/.env.prod      # set DOMAIN=restrogenic.shop
bash ~/restrogenic/deploy/deploy-lightsail.sh   # run again → builds & starts
```

### 4. Verify
```bash
cd ~/restrogenic/deploy
sudo docker compose -f docker-compose.prod.yml ps          # all "Up"
sudo docker compose -f docker-compose.prod.yml logs -f api  # watch boot/migrations
```
- App → `https://restrogenic.shop`
- Super-admin login → `admin@restrogenic.cloud` / `admin123` → **change this immediately**
- After first successful boot, set `SEED_ON_BOOT=false` in `.env.prod` and `up -d` again.

### 5. Backups (don't skip)
Lightsail Console → your instance → **Snapshots → Enable automatic snapshots** (~₹200/mo).
Test a restore once.

---

## Scheduled job — expire lapsed trials (required)
A daily cron must suspend trials that ended without paying. Add to the box's crontab
(`crontab -e`) — it logs in as platform admin and calls the expiry endpoint:

```cron
# every day at 02:00 — suspend expired trials
0 2 * * * TOKEN=$(curl -s -X POST https://api.restrogenic.shop/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@restrogenic.cloud","password":"YOUR_ADMIN_PW"}' \
  | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p'); \
  curl -s -X POST https://api.restrogenic.shop/api/admin/billing/expire-trials \
  -H "Authorization: Bearer $TOKEN" >> /var/log/restrogenic-cron.log 2>&1
```
(Or store an admin token in a file and reuse it.) Razorpay webhooks handle the rest:
`subscription.charged` → Active + invoice, `subscription.halted` → Suspended.

---

## Wildcard subdomains (`spice.restrogenic.shop`)
Caddy auto-issues a cert **per hostname** out of the box — so adding shops one-by-one in
the `Caddyfile` "just works". For a true `*.restrogenic.shop` wildcard cert (no per-shop edit),
use the **Cloudflare DNS-challenge** build of Caddy and the commented block in `Caddyfile`
(needs `CLOUDFLARE_API_TOKEN`). Simplest start: keep the root + api hosts, and resolve the
tenant from the `Host` header in Next.js middleware (see `../saas/ARCHITECTURE.md`).

---

## The control-plane API (now live in the backend)
The super-admin is no longer just the HTML prototype — it's real endpoints under
`/api/admin` in `apps/api/src/admin`:

| Method | Route | Does |
|--------|-------|------|
| POST | `/api/admin/login` | platform-admin login (separate token) |
| GET | `/api/admin/metrics` | MRR, ARR, shop counts, by-vertical |
| GET | `/api/admin/tenants` | list all shops (filter by status/type/search) |
| POST | `/api/admin/tenants` | **provision a new shop** (creates tenant + branch + owner + seed) |
| PATCH | `/api/admin/tenants/:id/suspend` · `/activate` | lock / unlock a shop |
| PATCH | `/api/admin/tenants/:id/plan` | change a shop's plan |
| GET/POST/PUT | `/api/admin/plans` | manage subscription plans |
| GET | `/api/admin/invoices` | billing history |

All `/admin/*` routes (except login) require a platform-admin token verified with
`PLATFORM_JWT_SECRET` — completely separate from shop-user auth, so a shop owner can never
reach the control plane. Point the `saas/super-admin.html` UI (or a future `apps/admin`
Next.js app) at these endpoints to manage live shops.

---

## Upgrade path (when you outgrow one box)
1. **~50+ shops / DB heavy** → move Postgres to **Lightsail Managed Database** or **RDS**
   (just change `DATABASE_URL`; drop the `postgres` service from compose).
2. **Hundreds of shops** → API to **App Runner / ECS Fargate** (see `../saas/AWS-DEPLOYMENT.md`).
   Same Docker image — no rewrite.
