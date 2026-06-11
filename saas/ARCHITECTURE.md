# RestroGenie Cloud — Multi-Tenant SaaS Architecture

How to turn the single-shop POS into a **multi-vertical, multi-tenant SaaS** that you
control from one super-admin panel and sell on monthly subscriptions.

---

## 1. The mental model

```
        ┌─────────────────────────────────────────────┐
        │           YOU (Platform Owner)              │
        │     Super-Admin Panel  (super-admin.html)   │
        │  create/suspend shops · plans · billing     │
        └───────────────────────┬─────────────────────┘
                                │  controls
        ┌───────────────────────┴─────────────────────┐
        │              ONE shared backend              │
        │        NestJS API  +  Postgres (Supabase)    │
        └──────┬───────────────┬───────────────┬───────┘
               │               │               │
        ┌──────┴─────┐  ┌──────┴─────┐  ┌──────┴─────┐
        │  Shop A    │  │  Shop B    │  │  Shop C    │   ← "tenants"
        │ Restaurant │  │  Grocery   │  │  Pharmacy  │
        │ spice.app  │  │ sharma.app │  │ medplus.app│
        └────────────┘  └────────────┘  └────────────┘
```

- **Tenant = one shop.** Every row of business data carries a `tenantId`.
- **One database, shared schema.** Tenants are isolated by `tenantId` filtering +
  Postgres Row-Level Security (RLS). This is the cheapest, simplest model and scales
  to thousands of shops. (Schema-per-tenant or DB-per-tenant only become worth it at
  large enterprise scale — you don't need them now.)
- **The backend you already built is the foundation.** `Restaurant → Branch → User`
  in `apps/api/prisma/schema.prisma` is already a tenant model. We rename/extend
  `Restaurant` → `Tenant` (a shop) and add SaaS control-plane tables.

> ⚠️ The single-file `restrogenic-pos.html` (localStorage) **cannot** be the SaaS —
> each browser is an island. It stays useful as: (a) a sales demo, (b) an **offline
> fallback** the real app falls back to when internet drops, syncing later.

---

## 2. Two planes

| Plane | Who uses it | App | Auth |
|-------|-------------|-----|------|
| **Control plane** | You (platform owner/staff) | Super-Admin panel | Platform admins table |
| **Tenant plane** | Each shop's owner & staff | The POS (web app) | Per-tenant users, scoped by `tenantId` |

A shop owner never sees other shops. You see everything.

---

## 3. Data model (control-plane additions)

Add these tables to the existing Prisma schema. (Keep all your POS tables — just add
`tenantId` to every business table and filter by it everywhere.)

```prisma
model Tenant {                       // = one shop
  id            String   @id @default(cuid())
  name          String
  shopType      String   // restaurant | retail | grocery | pharmacy
  subdomain     String   @unique     // spice.yourpos.app
  status        String   @default("Trial") // Trial|Active|Suspended|Cancelled
  planId        String
  ownerName     String
  ownerEmail    String   @unique
  phone         String?
  city          String?
  trialEndsAt   DateTime?
  createdAt     DateTime @default(now())
  plan          Plan     @relation(fields: [planId], references: [id])
  branches      Branch[]
  users         User[]
  subscription  Subscription?
}

model Plan {
  id          String  @id @default(cuid())
  name        String
  price       Int                    // ₹ per month, 0 = free
  interval    String  @default("monthly")
  maxBranches Int      @default(1)   // -1 = unlimited
  maxUsers    Int      @default(3)
  maxItems    Int      @default(200)
  modules     String                 // JSON array of enabled module keys
  featured    Boolean  @default(false)
  tenants     Tenant[]
}

model Subscription {
  id                String   @id @default(cuid())
  tenantId          String   @unique
  razorpaySubId     String?            // recurring subscription id
  status            String             // active|past_due|cancelled
  currentPeriodEnd  DateTime
  tenant            Tenant   @relation(fields: [tenantId], references: [id])
}

model Invoice {
  id        String   @id @default(cuid())
  tenantId  String
  number    String                     // INV-1001
  amount    Int
  status    String                     // Paid|Pending|Failed
  periodFrom DateTime
  periodTo   DateTime
  paidAt     DateTime?
  createdAt  DateTime @default(now())
}

model PlatformAdmin {                  // YOU and your team
  id           String @id @default(cuid())
  name         String
  email        String @unique
  passwordHash String
  role         String @default("admin") // admin | support | billing
}

model UsageDaily {                      // for metering & dashboards
  id        String   @id @default(cuid())
  tenantId  String
  date      DateTime
  orders    Int      @default(0)
  revenue   Int      @default(0)
  @@unique([tenantId, date])
}
```

**Every existing POS table** (`MenuItem`, `Order`, `StockItem`, …) gets a
`tenantId String` column + `@@index([tenantId])`. Every query filters by it.

---

## 4. Tenant isolation (the security-critical part)

Three layers, defence-in-depth:

1. **App layer** — a NestJS guard reads the tenant from the request (subdomain or JWT
   `tenantId` claim) and injects a Prisma "tenant-scoped client" so every query auto-adds
   `where: { tenantId }`. A shop user's JWT is signed with their `tenantId`; they can
   never set it themselves.
2. **Database layer (RLS)** — Supabase Postgres Row-Level Security policy:
   `USING (tenant_id = current_setting('app.tenant_id'))`. Even a bug in app code
   can't leak another shop's data.
3. **Routing layer** — `spice.yourpos.app` → resolves to `tenantId` before the request
   hits business logic. Suspended tenants are rejected at this gate.

The **super-admin** uses a *separate* privileged client that is **not** tenant-scoped,
so you can read across all shops.

---

## 5. Multi-vertical (restaurant + retail + grocery + pharmacy)

`Tenant.shopType` drives which modules + fields show. Keep ONE codebase; toggle features:

| Module | Restaurant | Retail | Grocery | Pharmacy |
|--------|:---------:|:------:|:-------:|:--------:|
| Billing + GST | ✅ | ✅ | ✅ | ✅ |
| Tables / KOT / KDS | ✅ | — | — | — |
| Recipe → stock deduction | ✅ | — | — | — |
| Barcode scan | optional | ✅ | ✅ | ✅ |
| Weight / loose qty | — | — | ✅ | — |
| Batch + expiry tracking | — | optional | optional | ✅ |
| Credit / khata ledger | — | optional | ✅ | optional |

Implementation: a `MODULES_BY_TYPE` config + a `<Feature flag="kot">` wrapper in the UI,
and the **Plan** also gates premium modules. Effective access = `shopType` ∩ `plan.modules`.

---

## 6. How a new shop gets created (provisioning flow)

```
Owner signs up (or you add them in super-admin)
        │
        ▼
Create Tenant row (status=Trial, 14 days)  +  default Branch  +  owner User
        │
        ▼
Seed starter data for that shopType (sample categories/products)
        │
        ▼
Reserve subdomain  spice.yourpos.app  (wildcard DNS already points to the app)
        │
        ▼
Send welcome email (login link + temp password)
        │
        ▼
Trial → on day 14, Razorpay subscription charges → status=Active
        (no payment → status=Suspended, data retained 30 days)
```

The super-admin panel's **"+ Add Shop"** button is exactly this flow (the prototype
does it in localStorage; production calls `POST /admin/tenants`).

---

## 7. Billing (monthly subscription)

- **Razorpay Subscriptions** (India): create a Plan in Razorpay matching each of your
  plans; subscribe the tenant; Razorpay auto-charges monthly via UPI-autopay/card/mandate.
- **Webhooks** (`subscription.charged`, `subscription.halted`) update `Subscription` +
  create `Invoice` rows → the super-admin **Billing** page reflects them.
- **Dunning:** payment fails → email + grace days → auto-`Suspended`.
- **MRR** = Σ price of all `Active` tenants. **ARR** = MRR × 12. (The panel computes these.)

---

## 8. Recommended repo layout (extends what you have)

```
apps/
  api/            NestJS — add /admin (control plane) + tenant guard + RLS
  web/            Next.js — the POS, resolves tenant from subdomain
  admin/          Next.js — the Super-Admin panel (productionized super-admin.html)
packages/
  shared/         types + MODULES_BY_TYPE config
```

Path to production from the prototype:
1. Add the control-plane tables above to Prisma; `prisma migrate`.
2. Build `/admin/*` API endpoints (`tenants`, `plans`, `invoices`, metrics).
3. Port `super-admin.html`'s screens to `apps/admin` calling those endpoints.
4. Add the tenant guard + RLS so the POS is tenant-scoped.
5. Wire Razorpay subscriptions + webhooks.
6. Wildcard subdomain routing.

See **HOSTING-GUIDE.md** to deploy and **SELLING-GUIDE.md** to price & sell.
