#!/bin/bash
set -e

# In production we run on PostgreSQL. The committed schema uses sqlite for local
# dev, so if DATABASE_URL points at Postgres, flip the provider and regenerate.
if echo "${DATABASE_URL}" | grep -qE '^postgres'; then
  echo "[entrypoint] Postgres detected → switching Prisma provider to postgresql"
  sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma || true
  npx prisma generate
fi

echo "[entrypoint] Applying database schema..."
# migrate deploy if migrations exist, else push the schema
if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  npx prisma migrate deploy
else
  npx prisma db push --accept-data-loss
fi

# Apply Postgres Row-Level Security policies (the multi-tenant safety net).
# Only on Postgres; psql ships in the postgres client. Non-fatal if unavailable.
if echo "${DATABASE_URL}" | grep -qE '^postgres' && [ -f prisma/rls/enable-rls.sql ]; then
  echo "[entrypoint] Applying Row-Level Security policies..."
  if command -v psql >/dev/null 2>&1; then
    psql "${DATABASE_URL}" -f prisma/rls/enable-rls.sql || echo "[entrypoint] RLS apply failed (non-fatal)"
  else
    echo "[entrypoint] psql not found — run prisma/rls/enable-rls.sql manually once"
  fi
fi

# Optional one-time seed of the SaaS control plane (platform admin + plans)
if [ "${SEED_ON_BOOT}" = "true" ]; then
  echo "[entrypoint] Seeding SaaS control plane..."
  npx ts-node --transpile-only prisma/seed-saas.ts || echo "[entrypoint] seed skipped/failed (non-fatal)"
fi

echo "[entrypoint] Starting API on :${PORT:-3001}"
exec node dist/src/main.js
