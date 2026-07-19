import { afterEach, describe, expect, it, vi } from "vitest";

import { listStudents } from "./admin-api";
import { createClient } from "./supabase/server";

vi.mock("./supabase/server", () => ({
  createClient: vi.fn()
}));

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

describe("admin API authentication", () => {
  it("envia somente o Bearer token ao usar Supabase", async () => {
    configureSupabaseEnv();
    mockSupabaseSession("access-token");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(emptyStudentsResponse), { status: 200 }));

    await listStudents({ page: "1" });

    const [, request] = fetchMock.mock.calls[0]!;
    expect(request?.headers).toMatchObject({
      authorization: "Bearer access-token"
    });
    expect(request?.headers).not.toHaveProperty("x-dev-user-id");
  });

  it("falha antes da chamada HTTP quando a sessao expirou", async () => {
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
  vi.stubEnv("ADMIN_ORGANIZATION_ID", "11111111-1111-4111-8111-111111111111");
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
