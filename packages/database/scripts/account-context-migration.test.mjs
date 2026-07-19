import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../prisma/migrations/20260718173000_add_actor_context_reader/migration.sql",
  import.meta.url
);

test("keeps account context privilege behind dedicated NOLOGIN roles", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /ALTER ROLE wefit_context_reader[\s\S]*BYPASSRLS NOLOGIN/);
  assert.match(sql, /ALTER ROLE wefit_context_consumer[\s\S]*NOBYPASSRLS NOLOGIN/);
  assert.match(sql, /SECURITY DEFINER[\s\S]*SET search_path = pg_catalog, public/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\."get_actor_context"\(\) FROM PUBLIC/);
  assert.match(
    sql,
    /GRANT EXECUTE ON FUNCTION public\."get_actor_context"\(\) TO wefit_context_consumer/
  );
  assert.doesNotMatch(sql, /GRANT\s+wefit_context_reader\s+TO\s+wefit_context_consumer/i);
});

test("derives context from the transaction actor without tenant parameters", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /CREATE OR REPLACE FUNCTION public\."get_actor_context"\(\)/);
  assert.match(sql, /public\."current_actor_user_id"\(\)/);
  assert.doesNotMatch(sql, /get_actor_context"\([^)]*(organization|unit|user)/i);
});
