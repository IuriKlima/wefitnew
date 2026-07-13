import { describe, expect, it } from "vitest";

import { isFeatureEnabled, resolveFeatureEntitlement } from "./entitlements.js";

describe("plan feature resolution", () => {
  it("resolves enabled features from configurable plan data", () => {
    const features = [
      {
        key: "students.manage",
        enabled: true,
        limitValue: null,
        config: { source: "plan-feature" }
      }
    ];

    expect(isFeatureEnabled(features, "students.manage")).toBe(true);
    expect(resolveFeatureEntitlement(features, "students.manage").config).toEqual({
      source: "plan-feature"
    });
  });

  it("defaults unknown features to disabled", () => {
    expect(isFeatureEnabled([], "access.devices")).toBe(false);
  });
});
