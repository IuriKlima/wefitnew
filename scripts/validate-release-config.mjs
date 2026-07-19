import { fileURLToPath } from "node:url";

const allowedLogLevels = new Set(["trace", "debug", "info", "warn", "error"]);
const allowedDatabaseSslModes = new Set(["require", "verify-ca", "verify-full"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readValue(env, name) {
  const value = env[name];

  return typeof value === "string" ? value.trim() : "";
}

function parseUrl(env, name, allowedProtocols, errors, options = {}) {
  const value = readValue(env, name);

  if (!value) {
    errors.push(`${name} is required.`);
    return undefined;
  }

  try {
    const url = new URL(value);

    if (!allowedProtocols.has(url.protocol)) {
      errors.push(`${name} must use an allowed protocol.`);
    }

    if (!url.hostname) {
      errors.push(`${name} must include a host.`);
    }

    if (options.disallowLocalhost && ["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
      errors.push(`${name} cannot point to localhost in a release environment.`);
    }

    if (options.disallowCredentials && (url.username || url.password)) {
      errors.push(`${name} cannot include credentials with the current worker implementation.`);
    }

    if (options.requireCredentials && (!url.username || !url.password)) {
      errors.push(`${name} must include username and password.`);
    }

    return url;
  } catch {
    errors.push(`${name} must be a valid URL.`);
    return undefined;
  }
}

function validateCorsOrigins(env, errors) {
  const value = readValue(env, "CORS_ORIGINS");

  if (!value) {
    errors.push("CORS_ORIGINS is required.");
    return;
  }

  for (const origin of value.split(",").map((item) => item.trim())) {
    if (!origin || origin === "*") {
      errors.push("CORS_ORIGINS cannot contain an empty value or wildcard.");
      continue;
    }

    try {
      const url = new URL(origin);
      if (url.protocol !== "https:" || url.origin !== origin.replace(/\/$/, "")) {
        errors.push("CORS_ORIGINS must contain HTTPS origins only.");
      }
    } catch {
      errors.push("CORS_ORIGINS must contain valid URLs.");
    }
  }
}

export function validateReleaseConfig(env = process.env) {
  const errors = [];

  if (!["staging", "production"].includes(readValue(env, "RELEASE_ENV"))) {
    errors.push("RELEASE_ENV must be staging or production.");
  }

  if (readValue(env, "NODE_ENV") !== "production") {
    errors.push("NODE_ENV must be production for a release deployment.");
  }

  if (readValue(env, "AUTH_ADAPTER") !== "supabase-jwt") {
    errors.push("AUTH_ADAPTER must be supabase-jwt; temporary authentication is not allowed.");
  }

  if (readValue(env, "ADMIN_AUTH_ADAPTER") !== "supabase-jwt") {
    errors.push("ADMIN_AUTH_ADAPTER must be supabase-jwt.");
  }

  if (readValue(env, "SWAGGER_ENABLED") !== "false") {
    errors.push("SWAGGER_ENABLED must be false for a release deployment.");
  }

  if (readValue(env, "ORGANIZATION_SELF_SERVICE_ENABLED") !== "false") {
    errors.push("ORGANIZATION_SELF_SERVICE_ENABLED must be false for a release deployment.");
  }

  if (readValue(env, "ADMIN_DEV_USER_ID")) {
    errors.push("ADMIN_DEV_USER_ID must not be configured for a release deployment.");
  }

  const rateLimitMax = Number(readValue(env, "RATE_LIMIT_MAX"));
  if (!Number.isSafeInteger(rateLimitMax) || rateLimitMax <= 0) {
    errors.push("RATE_LIMIT_MAX must be a positive integer.");
  }

  if (!allowedLogLevels.has(readValue(env, "LOG_LEVEL"))) {
    errors.push("LOG_LEVEL must use an approved level.");
  }

  const databaseUrl = parseUrl(env, "DATABASE_URL", new Set(["postgresql:", "postgres:"]), errors, {
    disallowLocalhost: true
  });
  if (databaseUrl && !allowedDatabaseSslModes.has(databaseUrl.searchParams.get("sslmode") ?? "")) {
    errors.push("DATABASE_URL must require TLS with an approved sslmode.");
  }
  parseUrl(env, "REDIS_URL", new Set(["rediss:"]), errors, {
    disallowLocalhost: true,
    requireCredentials: true
  });
  validateCorsOrigins(env, errors);

  const supabaseUrl = parseUrl(env, "SUPABASE_URL", new Set(["https:"]), errors, {
    disallowLocalhost: true
  });
  const supabaseJwksUrl = parseUrl(env, "SUPABASE_JWKS_URL", new Set(["https:"]), errors, {
    disallowLocalhost: true
  });
  const publicSupabaseUrl = parseUrl(env, "NEXT_PUBLIC_SUPABASE_URL", new Set(["https:"]), errors, {
    disallowLocalhost: true
  });
  parseUrl(env, "ADMIN_API_BASE_URL", new Set(["http:", "https:"]), errors, {
    disallowLocalhost: true
  });
  parseUrl(env, "RELEASE_API_URL", new Set(["https:"]), errors, { disallowLocalhost: true });
  parseUrl(env, "RELEASE_ADMIN_WEB_URL", new Set(["https:"]), errors, {
    disallowLocalhost: true
  });

  if (!readValue(env, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")) {
    errors.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required.");
  }

  const adminOrganizationId = readValue(env, "ADMIN_ORGANIZATION_ID");
  if (!uuidPattern.test(adminOrganizationId)) {
    errors.push("ADMIN_ORGANIZATION_ID must be a UUID.");
  }

  const adminUnitId = readValue(env, "ADMIN_UNIT_ID");
  if (adminUnitId && !uuidPattern.test(adminUnitId)) {
    errors.push("ADMIN_UNIT_ID must be a UUID when configured.");
  }

  if (supabaseUrl && publicSupabaseUrl && supabaseUrl.origin !== publicSupabaseUrl.origin) {
    errors.push("SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL must reference the same origin.");
  }

  if (
    supabaseUrl &&
    supabaseJwksUrl &&
    (supabaseUrl.origin !== supabaseJwksUrl.origin ||
      supabaseJwksUrl.pathname !== "/auth/v1/.well-known/jwks.json" ||
      supabaseJwksUrl.search)
  ) {
    errors.push("SUPABASE_JWKS_URL must use the expected JWKS endpoint on SUPABASE_URL.");
  }

  return errors;
}

function main() {
  const errors = validateReleaseConfig();

  if (errors.length > 0) {
    console.error("Release configuration is invalid:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Release configuration accepted.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
