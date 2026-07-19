import { afterEach, describe, expect, it, vi } from "vitest";

import type { CurrentAccountContext } from "@gym-platform/contracts";

import { readActiveContextSelection } from "./active-context";
import { listStudents } from "./admin-api";
import { createClient } from "./supabase/server";

vi.mock("./supabase/server", () => ({
  createClient: vi.fn()
}));

vi.mock("./active-context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./active-context")>()),
  readActiveContextSelection: vi.fn()
}));

const organizationId = "11111111-1111-4111-8111-111111111111";
const unitId = "22222222-2222-4222-8222-222222222222";
const accountContext: CurrentAccountContext = {
  user: { id: "33333333-3333-4333-8333-333333333333", name: "Pessoa" },
  organizations: [
    {
      id: organizationId,
      name: "Academia permitida",
      type: "GYM",
      isGlobalMember: true,
      roles: [{ key: "owner", name: "Owner", scope: "ORGANIZATION" }],
      units: [{ id: unitId, name: "Unidade permitida", code: "MAIN", isAllowed: true }]
    }
  ]
};
const emptyStudentsResponse = {
  data: [],
  pagination: {
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1
  }
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("admin API authentication and account context", () => {
  it("uses only the Supabase token and membership-validated active context", async () => {
    configureSupabaseEnv();
    vi.stubEnv("ADMIN_ORGANIZATION_ID", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    mockSupabaseSession("access-token");
    vi.mocked(readActiveContextSelection).mockResolvedValue({ organizationId, unitId });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = input.toString();
      return new Response(
        JSON.stringify(url.endsWith("/me/context") ? accountContext : emptyStudentsResponse),
        { status: 200 }
      );
    });

    await listStudents({ page: "1" });

    expect(fetchMock.mock.calls[0]?.[0].toString()).toBe("http://api.example.test/me/context");
    expect(fetchMock.mock.calls[1]?.[0].toString()).toContain(
      `/organizations/${organizationId}/students`
    );
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({
      authorization: "Bearer access-token",
      "x-unit-id": unitId
    });
    expect(fetchMock.mock.calls[1]?.[1]?.headers).not.toHaveProperty("x-dev-user-id");
  });

  it("fails before the context request when the Supabase session expired", async () => {
    configureSupabaseEnv();
    mockSupabaseSession();
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(listStudents({ page: "1" })).rejects.toMatchObject({
      statusCode: 401
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function configureSupabaseEnv(): void {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("ADMIN_AUTH_ADAPTER", "supabase-jwt");
  vi.stubEnv("ADMIN_API_BASE_URL", "http://api.example.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
}

function mockSupabaseSession(accessToken?: string): void {
  const client = {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: accessToken ? { access_token: accessToken } : null
        }
      })
    }
  } as unknown as Awaited<ReturnType<typeof createClient>>;

  vi.mocked(createClient).mockResolvedValue(client);
}
