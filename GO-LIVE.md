# 🚀 RestroGenie — Go Live

Three ways to put this online, from "instant demo" to "real SaaS business". Pick by what you need today.

---

## ⚡ Option 1 — Instant demo (FREE, ~30 sec) via Netlify Drop

The self-contained HTML apps need **no server** — they run entirely in the browser
(localStorage). Keeps your repo **private** while giving a public demo link.

1. Go to **https://app.netlify.com/drop**
2. Drag the project folder (or just the 3 HTML files) onto the page
3. You instantly get a live URL, e.g. `https://restrogenic-demo.netlify.app/restrogenic-pos.html`

| App | Path |
|-----|------|
| POS (full single-shop POS) | `/restrogenic-pos.html` |
| Super-Admin panel | `/saas/super-admin.html` |
| Signup / pricing page | `/saas/signup.html` |

> POS & Super-Admin are fully usable (localStorage). The Signup page needs the live
> backend (Option 2) for real account creation. *(GitHub Pages would also work but
> requires making the repo public — Netlify Drop keeps it private.)*

---

## 🏆 Option 2 — Full SaaS on AWS Lightsail (recommended, ~₹1,100/mo)

The real multi-tenant backend + database + auto-HTTPS. One $10 box.

### A. Create the server
- AWS Lightsail → **Create instance** → **Mumbai (ap-south-1)** → **Ubuntu 22.04** → **$10 plan**
- Create a **Static IP**, attach it
- **Networking** → open ports **80** and **443** (TCP)

### B. Point a domain at it
Buy a domain, then add DNS **A records** → your static IP:
```
restrogenic.shop   A   <STATIC_IP>
www           A   <STATIC_IP>
api           A   <STATIC_IP>
*             A   <STATIC_IP>     ← shop subdomains (spice.restrogenic.shop)
```

### C. Deploy (SSH into the box)

The repo is **private**, so first make a read-only token:
GitHub → **Settings → Developer settings → Fine-grained tokens → Generate** →
*Repository access:* only `restrogenic` → *Permissions:* **Contents → Read-only** → copy it.

```bash
# clone the private repo with the token (one time)
REPO_TOKEN=github_pat_XXXX bash <(curl -fsSL \
  "https://x-access-token:github_pat_XXXX@raw.githubusercontent.com/DJO1122/restrogenic/main/deploy/deploy-lightsail.sh")
# ↑ this installs Docker, clones, makes .env.prod with random secrets, then stops.

nano ~/restrogenic/deploy/.env.prod                # set DOMAIN=restrogenic.shop (+ PLATFORM_ADMIN_PASSWORD optional)
bash ~/restrogenic/deploy/deploy-lightsail.sh      # builds & starts everything
```
Simpler alternative — clone manually first, then run the script:
```bash
git clone https://x-access-token:github_pat_XXXX@github.com/DJO1122/restrogenic.git ~/restrogenic
bash ~/restrogenic/deploy/deploy-lightsail.sh      # → edit .env.prod when it stops, then run again
```
Caddy auto-issues HTTPS once DNS resolves (~1 min). Everything else (Postgres,
migrations, RLS, admin+plans seed) runs automatically on first boot.

### D. Verify & secure
```bash
cd ~/restrogenic/deploy
sudo docker compose -f docker-compose.prod.yml ps          # all "Up"
sudo docker compose -f docker-compose.prod.yml logs api | grep "Platform admin"   # grab your generated admin password
```
- App → `https://restrogenic.shop` · API → `https://api.restrogenic.shop`
- Log into the super-admin with the email/password from the logs.
- Set `SEED_ON_BOOT=false` in `.env.prod`, then `sudo docker compose -f docker-compose.prod.yml up -d`.

### E. Take payments (when ready)
In `.env.prod`: set `RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET`, map your plan ids
(`RAZORPAY_PLAN_PL_STARTER/PRO/PREM`), register the webhook
`https://api.restrogenic.shop/api/webhooks/razorpay`. Restart: `up -d`.

### F. Operations
- **Backups:** Lightsail → enable **automatic snapshots**.
- **Daily trial-expiry cron:** see the cron block in `deploy/README.md`.

---

## 🧩 Option 3 — Managed PaaS (no server, e.g. Render/Railway)
Connect this GitHub repo to Render/Railway, point it at `apps/api/Dockerfile` and
`apps/web/Dockerfile`, add a managed Postgres, and set the env vars from
`deploy/.env.prod.example`. Easiest if you never want to touch a server, but multiple
free services (API, web, DB) with cold-starts. Lightsail (Option 2) is cheaper & faster
once you have real customers.

---

## ✅ What runs automatically (you don't do these)
- Switch Prisma SQLite → PostgreSQL, run migrations
- Apply Postgres Row-Level Security policies (tenant isolation)
- Seed platform admin (random password printed in logs) + the 4 plans
- Auto-HTTPS via Caddy / Let's Encrypt

## 🔐 Must-do security (repo is public)
- [ ] Grab the **generated admin password** from the API logs (or set `PLATFORM_ADMIN_PASSWORD`)
- [ ] Never commit `.env.prod` (already git-ignored)
- [ ] `JWT_SECRET` / `PLATFORM_JWT_SECRET` are auto-randomized by the deploy script — don't reuse defaults

## 🆘 Troubleshooting
| Symptom | Fix |
|---------|-----|
| `https://` not working | DNS not resolved yet — wait 1–2 min; check A records point to the static IP |
| API container restarting | `docker compose logs api` — usually a missing env var in `.env.prod` |
| "Not allowed by CORS" | set `CORS_ORIGIN=https://*.restrogenic.shop,https://restrogenic.shop` in `.env.prod` |
| Can't log into super-admin | password is in the API boot logs (`logs api | grep Platform`) |
| Razorpay webhook 401 | `RAZORPAY_WEBHOOK_SECRET` must match the value in the Razorpay dashboard |

---
**Repo:** https://github.com/DJO1122/restrogenic
