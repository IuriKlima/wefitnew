import { fileURLToPath } from "node:url";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function required(env, name) {
  const value = env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

export function parseAuthenticatedSmokeConfig(env = process.env) {
  const apiUrl = new URL(required(env, "RELEASE_API_URL"));
  if (apiUrl.protocol !== "https:") {
    throw new Error("RELEASE_API_URL must use HTTPS.");
  }

  const organizationId = required(env, "RELEASE_SMOKE_ORGANIZATION_ID");
  if (!uuidPattern.test(organizationId)) {
    throw new Error("RELEASE_SMOKE_ORGANIZATION_ID must be a UUID.");
  }

  const forbiddenOrganizationId = env.RELEASE_SMOKE_FORBIDDEN_ORGANIZATION_ID?.trim();
  if (forbiddenOrganizationId && !uuidPattern.test(forbiddenOrganizationId)) {
    throw new Error("RELEASE_SMOKE_FORBIDDEN_ORGANIZATION_ID must be a UUID when configured.");
  }

  if (forbiddenOrganizationId === organizationId) {
    throw new Error("The allowed and forbidden smoke organizations must be different.");
  }

  return {
    apiUrl,
    accessToken: required(env, "RELEASE_SMOKE_ACCESS_TOKEN"),
    organizationId,
    forbiddenOrganizationId
  };
}

export async function runAuthenticatedSmoke(config, fetchImplementation = fetch) {
  const checks = [
    {
      name: "Authenticated units read",
      organizationId: config.organizationId,
      path: "units",
      expectedStatus: (status) => status >= 200 && status < 300
    },
    {
      name: "Authenticated students read",
      organizationId: config.organizationId,
      path: "students?page=1&pageSize=1",
      expectedStatus: (status) => status >= 200 && status < 300
    }
  ];

  if (config.forbiddenOrganizationId) {
    checks.push({
      name: "Cross-tenant read denied",
      organizationId: config.forbiddenOrganizationId,
      path: "units",
      expectedStatus: (status) => status === 403
    });
  }

  const results = [];
  for (const check of checks) {
    const url = new URL(`/organizations/${check.organizationId}/${check.path}`, config.apiUrl);
    const response = await fetchImplementation(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${config.accessToken}`
      },
      redirect: "error",
      signal: AbortSignal.timeout(10_000)
    });

    results.push({
      name: check.name,
      status: response.status,
      succeeded: check.expectedStatus(response.status)
    });
  }

  return results;
}

async function main() {
  const config = parseAuthenticatedSmokeConfig();
  const results = await runAuthenticatedSmoke(config);

  for (const result of results) {
    console.log(`${result.succeeded ? "OK" : "FAILED"} ${result.name}: HTTP ${result.status}`);
  }

  if (results.some((result) => !result.succeeded)) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Authenticated smoke failed.");
    process.exitCode = 1;
  });
}
