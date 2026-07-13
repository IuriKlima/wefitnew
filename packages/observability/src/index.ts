import { randomUUID } from "node:crypto";

const sensitiveKeys = new Set(
  ["authorization", "cookie", "password", "token", "secret", "accessToken", "refreshToken"].map(
    (key) => key.toLowerCase()
  )
);

const correlationIdPattern = /^[a-zA-Z0-9._:-]{1,100}$/;

export function createCorrelationId(): string {
  return randomUUID();
}

export function normalizeCorrelationId(input: string | string[] | undefined): string {
  const value = Array.isArray(input) ? input[0] : input;

  if (!value || !correlationIdPattern.test(value)) {
    return createCorrelationId();
  }

  return value;
}

export function redactSensitiveRecord(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => {
      if (sensitiveKeys.has(key.toLowerCase())) {
        return [key, "[REDACTED]"];
      }

      return [key, value];
    })
  );
}
