import { z } from "zod";

const optionalBooleanFromString = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    if (typeof value === "boolean") {
      return value;
    }

    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
  });

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).default("info")
});

export const apiEnvSchema = baseEnvSchema
  .extend({
    PORT: z.coerce.number().int().positive().default(3333),
    API_HOST: z.string().min(1).default("0.0.0.0"),
    DATABASE_URL: z.string().min(1),
    DIRECT_URL: z.string().min(1).optional(),
    REDIS_URL: z.string().min(1),
    CORS_ORIGINS: z.string().min(1).default("http://localhost:3000"),
    SWAGGER_ENABLED: optionalBooleanFromString,
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
    AUTH_ADAPTER: z
      .enum(["temporary-header", "external", "supabase-jwt"])
      .default("temporary-header"),
    ORGANIZATION_SELF_SERVICE_ENABLED: optionalBooleanFromString,
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_JWKS_URL: z.string().url().optional()
  })
  .transform((env) => ({
    ...env,
    SWAGGER_ENABLED: env.SWAGGER_ENABLED ?? env.NODE_ENV !== "production",
    ORGANIZATION_SELF_SERVICE_ENABLED:
      env.ORGANIZATION_SELF_SERVICE_ENABLED ?? env.NODE_ENV !== "production"
  }))
  .superRefine((env, context) => {
    if (env.NODE_ENV === "production" && env.AUTH_ADAPTER === "temporary-header") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["AUTH_ADAPTER"],
        message: "Temporary authentication adapter cannot be used in production."
      });
    }

    if (env.AUTH_ADAPTER === "supabase-jwt") {
      if (!env.SUPABASE_URL) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["SUPABASE_URL"],
          message: "SUPABASE_URL is required when using supabase-jwt auth adapter."
        });
      }
      if (!env.SUPABASE_JWKS_URL) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["SUPABASE_JWKS_URL"],
          message: "SUPABASE_JWKS_URL is required when using supabase-jwt auth adapter."
        });
      }
    }

    if (parseCorsOrigins(env.CORS_ORIGINS).includes("*")) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CORS_ORIGINS"],
        message: "CORS wildcard is not allowed when credentials are enabled."
      });
    }
  });

const redisUrlSchema = z
  .string()
  .url()
  .refine((value) => ["redis:", "rediss:"].includes(new URL(value).protocol), {
    message: "REDIS_URL must use redis:// or rediss://."
  });

export const workerEnvSchema = baseEnvSchema.extend({
  REDIS_URL: redisUrlSchema
});

export const testEnvSchema = z.object({
  DATABASE_URL_TEST: z.string().min(1),
  ALLOW_TEST_DATABASE_RESET: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true")
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;
export type TestEnv = z.infer<typeof testEnvSchema>;

export function loadApiEnv(input: NodeJS.ProcessEnv = process.env): ApiEnv {
  return apiEnvSchema.parse(input);
}

export function loadWorkerEnv(input: NodeJS.ProcessEnv = process.env): WorkerEnv {
  return workerEnvSchema.parse(input);
}

export function loadTestEnv(input: NodeJS.ProcessEnv = process.env): TestEnv {
  return testEnvSchema.parse(input);
}

export function parseCorsOrigins(value: string): string[] {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
