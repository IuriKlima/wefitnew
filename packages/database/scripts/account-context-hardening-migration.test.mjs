import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../prisma/migrations/20260719090000_harden_actor_context_access/migration.sql",
  import.meta.url
);

test("grants only the narrow context capability to the consumer", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /ALTER ROLE wefit_context_consumer[\s\S]*NOBYPASSRLS NOLOGIN/);
  assert.match(sql, /GRANT USAGE ON SCHEMA public TO wefit_context_consumer/);
  assert.match(sql, /REVOKE ALL PRIVILEGES ON ALL TABLES[\s\S]*wefit_context_consumer/);
  assert.match(sql, /REVOKE wefit_context_reader FROM wefit_context_consumer/);
  assert.match(sql, /SECURITY DEFINER[\s\S]*SET search_path = pg_catalog, public/);
  assert.doesNotMatch(sql, /GRANT\s+wefit_context_reader\s+TO\s+wefit_context_consumer/i);
});

test("requires an active actor, organization, role and operational unit", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /app_user\."deletedAt" IS NULL/);
  assert.match(sql, /organization\."deletedAt" IS NULL/);
  assert.match(sql, /membership\.status = 'ACTIVE'/);
  assert.match(sql, /membership\."deletedAt" IS NULL/);
  assert.match(sql, /INNER JOIN public\."MembershipRole"/);
  assert.match(sql, /INNER JOIN public\."Role"/);
  assert.match(sql, /INNER JOIN LATERAL[\s\S]*unit\."deletedAt" IS NULL/);
});
