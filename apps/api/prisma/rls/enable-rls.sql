-- ─────────────────────────────────────────────────────────────────────────────
-- RestroGenie — PostgreSQL Row-Level Security (multi-tenant safety net)
-- Apply AFTER `prisma migrate deploy` on Postgres. SQLite ignores this file.
--
-- How it works: the app sets a per-request/transaction GUC `app.restaurant_id`
-- (= the tenant id from the JWT). Every policy below restricts rows to that
-- tenant. Even if application code forgets a WHERE filter, the DB returns only
-- the current tenant's rows. Column names are Prisma's exact camelCase, quoted.
--
-- IMPORTANT: the app must connect as a role WITHOUT the BYPASSRLS attribute and
-- that is NOT the table owner (owners/superusers bypass RLS). See bottom.
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper: current tenant id from the session ('' when unset so nothing matches)
CREATE OR REPLACE FUNCTION app_current_tenant() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('app.restaurant_id', true), '')
$$;

-- ── Tier 1: tables with a direct "restaurantId" column ───────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['Restaurant','Branch','MenuCategory','Customer','Expense','Invoice','Subscription'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
  END LOOP;
END $$;

-- Restaurant keyed by its own id
CREATE POLICY tenant_isolation ON "Restaurant"
  USING ("id" = app_current_tenant())
  WITH CHECK ("id" = app_current_tenant());

-- Tables that carry "restaurantId"
CREATE POLICY tenant_isolation ON "Branch"
  USING ("restaurantId" = app_current_tenant()) WITH CHECK ("restaurantId" = app_current_tenant());
CREATE POLICY tenant_isolation ON "MenuCategory"
  USING ("restaurantId" = app_current_tenant()) WITH CHECK ("restaurantId" = app_current_tenant());
CREATE POLICY tenant_isolation ON "Customer"
  USING ("restaurantId" = app_current_tenant()) WITH CHECK ("restaurantId" = app_current_tenant());
CREATE POLICY tenant_isolation ON "Expense"
  USING ("restaurantId" = app_current_tenant()) WITH CHECK ("restaurantId" = app_current_tenant());
CREATE POLICY tenant_isolation ON "Invoice"
  USING ("restaurantId" = app_current_tenant()) WITH CHECK ("restaurantId" = app_current_tenant());
CREATE POLICY tenant_isolation ON "Subscription"
  USING ("restaurantId" = app_current_tenant()) WITH CHECK ("restaurantId" = app_current_tenant());

-- ── Tier 2: branch-scoped tables (branch belongs to one restaurant) ──────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['Table','Order','Shift','DailySummary','StockItem'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I
        USING ("branchId" IN (SELECT "id" FROM "Branch" WHERE "restaurantId" = app_current_tenant()))
        WITH CHECK ("branchId" IN (SELECT "id" FROM "Branch" WHERE "restaurantId" = app_current_tenant()))
    $f$, t);
  END LOOP;
END $$;

-- ── Tier 3: menu children (via category → restaurant) ────────────────────────
ALTER TABLE "MenuItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MenuItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "MenuItem";
CREATE POLICY tenant_isolation ON "MenuItem"
  USING ("categoryId" IN (SELECT "id" FROM "MenuCategory" WHERE "restaurantId" = app_current_tenant()))
  WITH CHECK ("categoryId" IN (SELECT "id" FROM "MenuCategory" WHERE "restaurantId" = app_current_tenant()));

-- ── Tier 4: order children (via order → branch → restaurant) ─────────────────
DO $$
DECLARE t text; col text;
BEGIN
  -- OrderItem.orderId, Payment.orderId
  FOREACH t IN ARRAY ARRAY['OrderItem','Payment'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I
        USING ("orderId" IN (
          SELECT o."id" FROM "Order" o JOIN "Branch" b ON o."branchId" = b."id"
          WHERE b."restaurantId" = app_current_tenant()))
        WITH CHECK ("orderId" IN (
          SELECT o."id" FROM "Order" o JOIN "Branch" b ON o."branchId" = b."id"
          WHERE b."restaurantId" = app_current_tenant()))
    $f$, t);
  END LOOP;
END $$;

-- NOTE: control-plane tables (Plan, PlatformAdmin) are intentionally NOT under
-- RLS — they are global and only reachable via the platform-admin connection.

-- ─────────────────────────────────────────────────────────────────────────────
-- One-time setup: a dedicated app role that RLS actually applies to.
-- Run these as the DB owner/superuser ONCE, then point DATABASE_URL at app_user.
-- ─────────────────────────────────────────────────────────────────────────────
-- CREATE ROLE app_user LOGIN PASSWORD 'CHANGE_ME' NOBYPASSRLS;
-- GRANT CONNECT ON DATABASE restrogenic TO app_user;
-- GRANT USAGE ON SCHEMA public TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
