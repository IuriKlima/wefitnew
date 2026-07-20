import { describe, expect, it, vi } from "vitest";

import { genericResponse, readPasswordChecks, requestSignup } from "./signup-form";

describe("signup security", () => {
  it("does not create a Supabase client when self-service is disabled", async () => {
    const clientFactory = vi.fn();

    const response = await requestSignup(
      {
        enabled: false,
        name: "Responsavel",
        email: "responsavel@example.test",
        password: "StrongPassword!1",
        emailRedirectTo: "http://localhost:3000/auth/callback"
      },
      clientFactory
    );

    expect(clientFactory).not.toHaveBeenCalled();
    expect(response).toBe(genericResponse);
  });

  it("returns the same safe response when Supabase rejects the request", async () => {
    const signUp = vi.fn().mockRejectedValue(new Error("account already exists"));

    const response = await requestSignup(
      {
        enabled: true,
        name: "Responsavel",
        email: "responsavel@example.test",
        password: "StrongPassword!1",
        emailRedirectTo: "http://localhost:3000/auth/callback"
      },
      () => ({ auth: { signUp } })
    );

    expect(signUp).toHaveBeenCalledOnce();
    expect(response).toBe(genericResponse);
  });

  it("requires all password strength signals", () => {
    expect(readPasswordChecks("weak")).toMatchObject({
      length: false,
      uppercase: false,
      lowercase: true,
      digit: false,
      symbol: false
    });
    expect(Object.values(readPasswordChecks("StrongPassword!1")).every(Boolean)).toBe(true);
  });
});
