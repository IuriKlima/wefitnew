import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../prisma/migrations/20260719091000_restore_business_rls_posture/migration.sql",
  import.meta.url
);

const rlsTables = [
  "Organization",
  "Unit",
  "Membership",
  "Role",
  "MembershipRole",
  "RolePermission",
  "OrganizationSubscription",
  "Student",
  "StudentUnit",
  "AuditLog"
];

test("enables and forces RLS on every protected business table", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  for (const table of rlsTables) {
    assert.match(sql, new RegExp(`ALTER TABLE public\\."${table}" ENABLE ROW LEVEL SECURITY`));
    assert.match(sql, new RegExp(`ALTER TABLE public\\."${table}" FORCE ROW LEVEL SECURITY`));
  }
});
