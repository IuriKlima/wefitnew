import { jwtVerify } from "jose";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SupabaseJwtAuthAdapter } from "./supabase.js";

vi.mock("jose", () => ({
  createRemoteJWKSet: vi.fn().mockReturnValue({}),
  jwtVerify: vi.fn()
}));

describe("supabase jwt auth adapter", () => {
  let adapter: SupabaseJwtAuthAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new SupabaseJwtAuthAdapter("https://foo.supabase.co/auth/v1/.well-known/jwks.json");
  });

  it("returns null if no authorization header is provided", async () => {
    const actor = await adapter.resolveActor({});
    expect(actor).toBeNull();
  });

  it("returns null if authorization header does not start with Bearer", async () => {
    const actor = await adapter.resolveActor({
      authorization: "Basic 123"
    });
    expect(actor).toBeNull();
  });

  it("returns null if token is invalid or signature fails", async () => {
    vi.mocked(jwtVerify).mockRejectedValueOnce(new Error("invalid token"));

    const actor = await adapter.resolveActor({
      authorization: "Bearer invalid-token"
    });

    expect(actor).toBeNull();
  });

  it("returns null if token does not have a sub claim", async () => {
    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { audience: "authenticated" },
      protectedHeader: { alg: "RS256" },
      key: {} as any
    });

    const actor = await adapter.resolveActor({
      authorization: "Bearer valid-token-without-sub"
    });

    expect(actor).toBeNull();
  });

  it("resolves user id from sub claim on successful verification", async () => {
    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { sub: "user-123", audience: "authenticated" },
      protectedHeader: { alg: "RS256" },
      key: {} as any
    });

    const actor = await adapter.resolveActor({
      authorization: "Bearer valid-token"
    });

    expect(actor).toEqual({ userId: "user-123" });
    expect(jwtVerify).toHaveBeenCalledWith("valid-token", expect.anything(), {
      audience: "authenticated"
    });
  });
});
