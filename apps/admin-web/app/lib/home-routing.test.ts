import { describe, expect, it } from "vitest";

import type { OnboardingAvailability } from "@gym-platform/contracts";

import { resolveHomeDestination } from "./home-routing";

const unavailable: OnboardingAvailability = {
  selfServiceEnabled: false,
  onboarding: null
};

describe("home routing", () => {
  it("routes lifecycle states using backend-derived context", () => {
    expect(resolveHomeDestination("ACTIVE", unavailable)).toBe("dashboard");
    expect(resolveHomeDestination("ONBOARDING", unavailable)).toBe("/onboarding");
    expect(resolveHomeDestination("SUSPENDED", unavailable)).toBe("/suspended");
  });

  it("routes an actor without membership to onboarding only when enabled", () => {
    expect(resolveHomeDestination(null, unavailable)).toBe("no-access");
    expect(resolveHomeDestination(null, { selfServiceEnabled: true, onboarding: null })).toBe(
      "/onboarding"
    );
  });
});
