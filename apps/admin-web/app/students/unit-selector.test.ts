import { describe, expect, it } from "vitest";

import { resolveUnitSelectionMode } from "./unit-selector";

describe("student unit selector", () => {
  it.each([
    ["PERSONAL", "main"],
    ["GYM", "single"],
    ["NETWORK", "multiple"]
  ] as const)("maps %s organizations to %s selection", (organizationType, expectedMode) => {
    expect(resolveUnitSelectionMode(organizationType)).toBe(expectedMode);
  });
});
