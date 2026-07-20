import { afterEach, describe, expect, it, vi } from "vitest";

import { readAdminAuthAdapter, readAdminSelfServiceEnabled, readSafeNextPath } from "./admin-auth";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("admin authentication configuration", () => {
  it("usa Supabase por padrao em producao", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_AUTH_ADAPTER", "");

    expect(readAdminAuthAdapter()).toBe("supabase-jwt");
  });

  it("permite o adapter temporário somente fora de produção", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ADMIN_AUTH_ADAPTER", "temporary-header");

    expect(readAdminAuthAdapter()).toBe("temporary-header");

    vi.stubEnv("NODE_ENV", "production");
    expect(() => readAdminAuthAdapter()).toThrow("apenas em desenvolvimento e teste");
  });

  it("evita redirecionamentos externos após o login", () => {
    expect(readSafeNextPath("/students?page=2")).toBe("/students?page=2");
    expect(readSafeNextPath("https://example.com")).toBe("/");
    expect(readSafeNextPath("//example.com")).toBe("/");
    expect(readSafeNextPath("/\\example.com")).toBe("/");
    expect(readSafeNextPath("/login?next=/login")).toBe("/");
  });

  it("mantem self-service desligado por padrao e rejeita ativacao em producao", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_ORGANIZATION_SELF_SERVICE_ENABLED", "");
    expect(readAdminSelfServiceEnabled()).toBe(false);

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_ORGANIZATION_SELF_SERVICE_ENABLED", "true");
    expect(() => readAdminSelfServiceEnabled()).toThrow("cannot be enabled in production");
  });
});
