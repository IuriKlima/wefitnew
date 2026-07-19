import assert from "node:assert/strict";
import test from "node:test";

import { parseAuthenticatedSmokeConfig, runAuthenticatedSmoke } from "../smoke-authenticated.mjs";

const organizationId = "11111111-1111-4111-8111-111111111111";
const forbiddenOrganizationId = "22222222-2222-4222-8222-222222222222";

test("runs read-only authenticated checks without exposing the token", async () => {
  const requests = [];
  const config = parseAuthenticatedSmokeConfig({
    RELEASE_API_URL: "https://api.staging.example.com",
    RELEASE_SMOKE_ACCESS_TOKEN: "secret-token",
    RELEASE_SMOKE_ORGANIZATION_ID: organizationId,
    RELEASE_SMOKE_FORBIDDEN_ORGANIZATION_ID: forbiddenOrganizationId
  });

  const results = await runAuthenticatedSmoke(config, async (url, init) => {
    requests.push({ url: url.toString(), init });
    return { status: url.toString().includes(forbiddenOrganizationId) ? 403 : 200 };
  });

  assert.equal(requests.length, 3);
  assert.ok(requests.every(({ init }) => init.method === "GET"));
  assert.ok(requests.every(({ init }) => init.redirect === "error"));
  assert.ok(requests.every(({ init }) => init.headers.authorization === "Bearer secret-token"));
  assert.deepEqual(
    results.map(({ succeeded }) => succeeded),
    [true, true, true]
  );
  assert.equal(JSON.stringify(results).includes("secret-token"), false);
});

test("rejects insecure or ambiguous configuration", () => {
  assert.throws(
    () =>
      parseAuthenticatedSmokeConfig({
        RELEASE_API_URL: "http://api.staging.example.com",
        RELEASE_SMOKE_ACCESS_TOKEN: "token",
        RELEASE_SMOKE_ORGANIZATION_ID: organizationId
      }),
    /must use HTTPS/
  );

  assert.throws(
    () =>
      parseAuthenticatedSmokeConfig({
        RELEASE_API_URL: "https://api.staging.example.com",
        RELEASE_SMOKE_ACCESS_TOKEN: "token",
        RELEASE_SMOKE_ORGANIZATION_ID: organizationId,
        RELEASE_SMOKE_FORBIDDEN_ORGANIZATION_ID: organizationId
      }),
    /must be different/
  );
});
