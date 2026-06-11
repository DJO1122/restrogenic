# RestroGenie on AWS — Deployment Guide

Deploy the **NestJS API** (`apps/api`) + **Next.js frontend** (`apps/web`) + **PostgreSQL**
on AWS. Three paths — pick by your stage. Tailored to this repo (you already have
`apps/api/Dockerfile`, `apps/web/Dockerfile`, and `docker-compose.yml`).

> ⚠️ Honest note: AWS is more powerful but **more expensive and more complex** than the
> Supabase + Render + Vercel path in `HOSTING-GUIDE.md`. Use AWS if you want everything in
> one cloud, have AWS credits, or need enterprise credibility. For a first launch on a
> budget, the managed path is faster. This guide gets you onto AWS cleanly either way.

---

## Which path?

| Path | Best for | Monthly cost (light) | Ops effort |
|------|----------|----------------------|-----------|
| **A. App Runner + Amplify + RDS** ⭐ | Solo founder, want managed AWS | ~$45–70 (~₹4–6k) | Low |
| **B. ECS Fargate + ALB + Aurora** | Scaling SaaS, many shops | ~$120+ (~₹10k+) | Medium |
| **C. Single EC2 + Docker Compose** | Cheapest, full control | ~$10–20 (~₹1–1.7k) | High (you own everything) |

Start with **Path A**. You can graduate to B later without rewriting the app.

---

## AWS architecture (Path A — recommended)

```
                        Route 53  (yourpos.com + *.yourpos.com)
                            │            + ACM (free SSL)
            ┌───────────────┼────────────────────┐
            ▼                                     ▼
   AWS Amplify Hosting                    AWS App Runner
   (Next.js apps/web)   ──HTTPS──►        (NestJS apps/api, container)
   shop subdomains                              │
                                                ▼
                                     Amazon RDS for PostgreSQL
                                     (multi-tenant DB, tenantId + RLS)
            ┌───────────────┬────────────────────┼───────────────┐
            ▼               ▼                     ▼               ▼
        S3 (logos)   Secrets Manager        SES (emails)   ElastiCache
        + uploads    (DB url, JWT)          welcome/invoice  Redis (optional)
```

ECR stores your API Docker image. GitHub Actions builds & pushes on every commit.

---

## Prerequisites

1. **AWS account** + an IAM user with admin (for setup) — or use IAM Identity Center.
2. **AWS CLI** installed & configured: `aws configure` (set region, e.g. `ap-south-1` Mumbai — closest to India = lowest latency).
3. **Docker** installed locally.
4. A **domain** (buy in Route 53, ~$12/yr, or transfer an existing one).
5. Your repo on **GitHub** (for Amplify + CI/CD).

```bash
aws --version            # confirm CLI
aws sts get-caller-identity   # confirm you're authenticated
export AWS_REGION=ap-south-1
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
```

---

## PATH A — Step by step

### 1. Database — Amazon RDS for PostgreSQL

Create a small Postgres instance (db.t4g.micro is plenty to start):

```bash
aws rds create-db-instance \
  --db-instance-identifier restrogenic-db \
  --db-instance-class db.t4g.micro \
  --engine postgres --engine-version 16 \
  --allocated-storage 20 --storage-type gp3 \
  --master-username rgadmin \
  --master-user-password "CHANGE_ME_strong_pw" \
  --db-name restrogenic \
  --backup-retention-period 7 \
  --no-publicly-accessible \
  --region $AWS_REGION
```

- Put it in **private subnets**; only the API security group may reach port 5432.
- Turn on **automated backups** (7 days above) + a final snapshot policy.
- Grab the endpoint when ready:
  ```bash
  aws rds describe-db-instances --db-instance-identifier restrogenic-db \
    --query 'DBInstances[0].Endpoint.Address' --output text
  ```
- `DATABASE_URL = postgresql://rgadmin:PW@<endpoint>:5432/restrogenic?schema=public`

> For auto-scaling DB later, switch to **Aurora Serverless v2 (PostgreSQL)** — scales to
> zero-ish on low traffic, great for multi-tenant SaaS. Same Prisma URL.

### 2. Point Prisma at Postgres + migrate

Your local schema was switched to SQLite. For AWS, set it back to Postgres:

```prisma
// apps/api/prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

The String-based fields you have work on Postgres as-is. (Optionally restore real
`enum`s and `@db.Decimal(10,2)` for money columns — recommended for production accuracy,
not required to boot.) Then from a machine that can reach RDS (or via a bastion/SSM):

```bash
cd apps/api
DATABASE_URL="postgresql://..." npx prisma migrate deploy
DATABASE_URL="postgresql://..." npm run db:seed   # optional demo data
```

### 3. Build & push the API image to ECR

```bash
# create the repo
aws ecr create-repository --repository-name restrogenic-api --region $AWS_REGION

# login docker to ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# build for amd64 (App Runner runs x86) & push
cd apps/api
docker build --platform linux/amd64 -t restrogenic-api .
docker tag restrogenic-api:latest $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/restrogenic-api:latest
docker push $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/restrogenic-api:latest
```

> Your `apps/api/Dockerfile` already builds NestJS + runs `prisma generate`. Make sure it
> ends with `CMD ["node","dist/src/main.js"]` (note the `dist/src/` path for this repo) and
> `EXPOSE 3001`.

### 4. Store secrets in Secrets Manager

```bash
aws secretsmanager create-secret --name restrogenic/api \
  --secret-string '{"DATABASE_URL":"postgresql://...","JWT_SECRET":"<64-char>","CORS_ORIGIN":"https://*.yourpos.com"}'
```

### 5. Deploy the API to App Runner

Easiest via the Console (App Runner → Create service → Container registry → pick your ECR
image → port **3001** → add env vars from Secrets Manager → set health check path `/api`
or add a `/health` route). Or CLI with an `apprunner.json`. App Runner gives you:
- Auto HTTPS URL like `https://xxxx.ap-south-1.awsapprunner.com`
- Auto-scaling + zero server management
- Connect it to the RDS VPC via an **App Runner VPC connector** so it can reach the DB.

### 6. Deploy the frontend (Next.js) to AWS Amplify Hosting

Amplify is the AWS equivalent of Vercel for Next.js (supports SSR/App Router):

1. Amplify Console → **New app → Host web app** → connect GitHub → pick repo.
2. App root: `apps/web`. Amplify auto-detects Next.js. Build settings:
   ```yaml
   version: 1
   applications:
     - appRoot: apps/web
       frontend:
         phases:
           preBuild: { commands: [ "npm ci" ] }
           build:    { commands: [ "npm run build" ] }
         artifacts: { baseDirectory: .next, files: [ "**/*" ] }
   ```
3. Env var: `NEXT_PUBLIC_API_URL=https://api.yourpos.com`.
4. Deploy → Amplify gives an `https://...amplifyapp.com` URL.

### 7. Domain, SSL & wildcard subdomains — Route 53 + ACM

Multi-tenant needs `spice.yourpos.com`, `sharma.yourpos.com`, etc.

1. **Route 53** hosted zone for `yourpos.com`.
2. **ACM** (in your region, and `us-east-1` for CloudFront/Amplify) → request a cert for
   `yourpos.com` **and** `*.yourpos.com` (wildcard) → validate via DNS (Route 53 adds records).
3. In **Amplify → Domain management**: add `yourpos.com`, `www`, and the **wildcard
   `*.yourpos.com`** → maps every shop subdomain to the Next.js app.
4. Add `api.yourpos.com` → custom domain on the App Runner service.
5. In Next.js middleware, read the `Host` header, extract the subdomain → resolve `tenantId`
   (see `ARCHITECTURE.md` §4 & §6).

### 8. Supporting services

- **S3** for logo/receipt uploads: `aws s3 mb s3://restrogenic-uploads-<unique>` → presigned-URL uploads from the app.
- **SES** for transactional email (welcome, invoice, dunning): verify your domain, request production access (out of sandbox).
- **ElastiCache (Redis)** — only if you turn on Socket.IO scaling / queues. Optional at start.
- **CloudWatch** — logs + alarms (CPU, DB connections, 5xx). Set a billing alarm too.

---

## CI/CD — GitHub Actions (build API image, push, deploy)

`.github/workflows/deploy-api.yml`:

```yaml
name: Deploy API
on: { push: { branches: [main], paths: ["apps/api/**"] } }
permissions: { id-token: write, contents: read }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::ACCOUNT_ID:role/gha-deploy
          aws-region: ap-south-1
      - uses: aws-actions/amazon-ecr-login@v2
      - run: |
          IMG=$ACCOUNT.dkr.ecr.ap-south-1.amazonaws.com/restrogenic-api
          docker build --platform linux/amd64 -t $IMG:${{ github.sha }} apps/api
          docker push $IMG:${{ github.sha }}
      - run: aws apprunner start-deployment --service-arn ${{ secrets.APPRUNNER_ARN }}
```

(Amplify auto-deploys the frontend on every push by default — no workflow needed.)

---

## Cost estimate (Path A, Mumbai region, low traffic)

| Service | ~Monthly |
|---------|---------|
| RDS db.t4g.micro + 20GB gp3 + backups | ~$15–20 |
| App Runner (1 vCPU/2GB, low traffic) | ~$25–40 |
| Amplify Hosting (build + bandwidth) | ~$1–10 |
| Route 53 hosted zone + queries | ~$1 |
| S3 + SES + CloudWatch | ~$1–5 |
| **Total** | **~$45–75/mo (₹4–6.5k)** |

Scales with usage. With AWS Activate credits (startups can get $1k–$100k) this is ~free for a while.

---

## PATH B — Production/scale (ECS Fargate + ALB + Aurora)

When you outgrow App Runner (need fine-grained scaling, multiple services, private
networking, blue/green):
- **ECS Fargate** service for the API behind an **Application Load Balancer** (ALB) with the
  ACM cert; target group health check on `/api`.
- **Aurora Serverless v2 (PostgreSQL)** for the DB (auto-scales).
- **CloudFront** in front of Amplify/S3 for global caching + WAF for security.
- Define it all with **AWS CDK** or **Terraform** so it's reproducible. (I can generate a
  Terraform/CDK stack for this on request.)

## PATH C — Cheapest (single EC2 + Docker Compose)

You already have `docker-compose.yml`. On one `t4g.small` EC2 (~$12/mo):
1. Launch Ubuntu EC2, open ports 80/443, attach an Elastic IP.
2. Install Docker + Docker Compose.
3. Add **Caddy** as a reverse proxy (auto-SSL + wildcard via DNS challenge) in front of
   `web:3000` and `api:3001`.
4. `git pull && docker compose up -d --build` to deploy.
- Trade-off: you own backups, SSL renewal, OS patching, uptime. Fine for first few shops or a demo; move to A/B as you grow.

---

## Security checklist (before first paying shop)

- [ ] RDS in **private subnets**, not publicly accessible; SG allows only the API
- [ ] Secrets in **Secrets Manager / SSM**, never in the image or git
- [ ] **HTTPS only** (ACM everywhere); redirect 80→443
- [ ] **RLS** on every tenant table in Postgres (test cross-tenant isolation) — see `ARCHITECTURE.md` §4
- [ ] RDS **automated backups** on + test a restore
- [ ] **CloudWatch billing alarm** + resource alarms (CPU, DB connections, 5xx)
- [ ] IAM least-privilege; use **OIDC role** for GitHub Actions (no long-lived keys)
- [ ] WAF on the ALB/CloudFront (rate limiting, common rules) when on Path B
- [ ] `region = ap-south-1` (Mumbai) for India latency + data residency

---

## Quick start (the 8 things, in order)

1. RDS Postgres → get `DATABASE_URL`
2. Prisma `provider = postgresql` → `prisma migrate deploy`
3. ECR repo → build & push API image
4. Secrets Manager → store env
5. App Runner → deploy API (VPC-connect to RDS) → `api.yourpos.com`
6. Amplify → deploy `apps/web` → `*.yourpos.com`
7. Route 53 + ACM → domain + wildcard SSL
8. S3 + SES → uploads + email

> Want me to generate the **Terraform/CDK** for Path B, or a **ready-to-run deploy script**
> for Path A/C? Ask and I'll add it to this folder.
