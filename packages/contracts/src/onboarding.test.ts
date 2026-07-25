import { describe, expect, it } from "vitest";

import { isOnboardingPlanCompatible, onboardingPlanCompatibility } from "./onboarding.js";

describe("onboarding plan compatibility", () => {
  it("keeps the MVP matrix explicit and one-to-one", () => {
    expect(onboardingPlanCompatibility).toEqual({
      PERSONAL: ["PERSONAL"],
      GYM: ["GYM"],
      NETWORK: ["NETWORK"]
    });
  });

  it.each([
    ["PERSONAL", "PERSONAL", true],
    ["GYM", "GYM", true],
    ["NETWORK", "NETWORK", true],
    ["PERSONAL", "GYM", false],
    ["PERSONAL", "NETWORK", false],
    ["GYM", "PERSONAL", false],
    ["GYM", "NETWORK", false],
    ["NETWORK", "PERSONAL", false],
    ["NETWORK", "GYM", false]
  ] as const)("validates %s with %s", (businessType, planCode, expected) => {
    expect(isOnboardingPlanCompatible(businessType, planCode)).toBe(expected);
  });
});
