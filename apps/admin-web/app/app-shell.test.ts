import { describe, expect, it } from "vitest";

import { isStandaloneAppRoute } from "./app-shell";

describe("admin app shell", () => {
  it("always keeps onboarding outside the administrative sidebar", () => {
    expect(isStandaloneAppRoute("/onboarding")).toBe(true);
    expect(isStandaloneAppRoute("/onboarding/review")).toBe(true);
    expect(isStandaloneAppRoute("/students")).toBe(false);
  });
});
