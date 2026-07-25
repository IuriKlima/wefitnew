import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../prisma/migrations/20260725190000_harden_rls_helper_owner/migration.sql",
  import.meta.url
);

test("keeps the RLS helper owner privileged but unreachable from runtime consumers", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(
    sql,
    /ALTER ROLE wefit_rls_owner[\s\S]*NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS NOLOGIN/
  );
  assert.match(sql, /REVOKE wefit_rls_owner FROM wefit_context_consumer/);
  assert.match(sql, /REVOKE wefit_rls_owner FROM wefit_onboarding_consumer/);
  assert.doesNotMatch(sql, /GRANT\s+wefit_rls_owner\s+TO/i);
});
