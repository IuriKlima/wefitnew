import assert from "node:assert/strict";
import test from "node:test";

import { parseProvisionConfig } from "./provision-beta-tenant-lib.mjs";

function createValidEnv() {
  return {
    BETA_PROVISION_ENV: "staging",
    BETA_PROVISION_DATABASE_URL:
      "postgresql://provisioner:secret@database.example.com:5432/gym_staging?sslmode=require",
    BETA_PROVISION_EXPECTED_DATABASE: "gym_staging",
    BETA_PROVISION_ACTOR_USER_ID: "11111111-1111-4111-8111-111111111111",
    BETA_PROVISION_ORGANIZATION_TYPE: "GYM",
    BETA_PROVISION_ORGANIZATION_LEGAL_NAME: "Academia Beta Ltda",
    BETA_PROVISION_ORGANIZATION_TRADE_NAME: "Academia Beta",
    BETA_PROVISION_ORGANIZATION_SLUG: "academia-beta",
    BETA_PROVISION_DEFAULT_UNIT_NAME: "Unidade Principal",
    BETA_PROVISION_CONFIRM: "academia-beta"
  };
}

test("accepts an explicitly confirmed staging provision", () => {
  const config = parseProvisionConfig(createValidEnv());

  assert.equal(config.environment, "staging");
  assert.equal(config.databaseName, "gym_staging");
  assert.equal(config.dryRun, false);
  assert.equal(config.organization.slug, "academia-beta");
});

test("requires an exact database and environment match", () => {
  assert.throws(
    () =>
      parseProvisionConfig({
        ...createValidEnv(),
        BETA_PROVISION_EXPECTED_DATABASE: "gym_production"
      }),
    /does not match/
  );
});

test("requires TLS and exact confirmation before a write", () => {
  assert.throws(
    () =>
      parseProvisionConfig({
        ...createValidEnv(),
        BETA_PROVISION_DATABASE_URL:
          "postgresql://provisioner:secret@database.example.com:5432/gym_staging"
      }),
    /require TLS/
  );

  assert.throws(
    () => parseProvisionConfig({ ...createValidEnv(), BETA_PROVISION_CONFIRM: "wrong" }),
    /exactly/
  );
});

test("allows a dry run without a write confirmation", () => {
  const config = parseProvisionConfig({ ...createValidEnv(), BETA_PROVISION_CONFIRM: "" }, [
    "--dry-run"
  ]);

  assert.equal(config.dryRun, true);
});
