import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../prisma/migrations/20260719100000_add_guided_organization_onboarding/migration.sql",
  import.meta.url
);
const rlsGrantMigrationUrl = new URL(
  "../prisma/migrations/20260719110000_grant_onboarding_rls_helpers/migration.sql",
  import.meta.url
);

test("creates tenant-aware lifecycle and persistent onboarding state", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /"OrganizationLifecycle" AS ENUM \('ONBOARDING', 'ACTIVE', 'SUSPENDED'\)/);
  assert.match(sql, /ADD COLUMN "lifecycle"[\s\S]*NOT NULL DEFAULT 'ACTIVE'/);
  assert.match(sql, /CREATE TABLE public\."OrganizationOnboarding"/);
  assert.match(sql, /"organizationId" uuid NOT NULL/);
  assert.match(sql, /"createdByUserId" uuid NOT NULL/);
  assert.match(sql, /"payloadVersion" integer NOT NULL DEFAULT 1/);
  assert.match(sql, /"version" integer NOT NULL DEFAULT 1/);
  assert.match(sql, /one_active_per_organization_key/);
  assert.match(sql, /one_active_per_actor_key/);
});

test("keeps bootstrap authority behind narrow NOLOGIN roles", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /ALTER ROLE wefit_onboarding_owner[\s\S]*BYPASSRLS NOLOGIN/);
  assert.match(sql, /ALTER ROLE wefit_onboarding_consumer[\s\S]*NOBYPASSRLS NOLOGIN/);
  assert.match(sql, /CREATE FUNCTION public\."start_actor_onboarding"\(\s*actor_email text/);
  assert.match(sql, /public\."current_actor_user_id"\(\)/);
  assert.match(sql, /SECURITY DEFINER[\s\S]*SET search_path = pg_catalog, public/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\."start_actor_onboarding"/);
  assert.match(sql, /TO wefit_onboarding_consumer/);
  assert.doesNotMatch(sql, /GRANT\s+wefit_onboarding_owner\s+TO\s+wefit_onboarding_consumer/i);
  assert.doesNotMatch(sql, /start_actor_onboarding"\([^)]*(organization_id|user_id|unit_id)/i);
});

test("forces RLS and exposes lifecycle through authenticated context", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /OrganizationOnboarding" ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /OrganizationOnboarding" FORCE ROW LEVEL SECURITY/);
  assert.match(sql, /CREATE POLICY "OrganizationOnboarding_select"/);
  assert.match(sql, /public\."has_global_scope"\("organizationId"\)/);
  assert.match(sql, /"organizationLifecycle" text/);
  assert.match(sql, /organization\.lifecycle::text AS "organizationLifecycle"/);
});

test("grants only the RLS helpers required by ordinary onboarding queries", async () => {
  const sql = await readFile(rlsGrantMigrationUrl, "utf8");

  assert.match(sql, /ALTER ROLE wefit_onboarding_consumer[sS]*NOBYPASSRLS NOLOGIN/);
  assert.match(
    sql,
    /GRANT EXECUTE ON FUNCTION public."has_global_scope"(uuid)[sS]*wefit_onboarding_consumer/
  );
  assert.match(
    sql,
    /GRANT EXECUTE ON FUNCTION public."can_access_unit"(uuid, uuid)[sS]*wefit_onboarding_consumer/
  );
  assert.match(sql, /REVOKE wefit_onboarding_owner FROM wefit_onboarding_consumer/);
  assert.doesNotMatch(sql, /GRANTs+wefit_onboarding_owners+TOs+wefit_onboarding_consumer/i);
});
