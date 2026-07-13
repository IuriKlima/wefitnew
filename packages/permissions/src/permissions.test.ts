import { describe, expect, it } from "vitest";

import { hasPermission, listDefaultOwnerPermissions, permissionKeys } from "./permissions.js";

describe("permissions matrix", () => {
  it("allows organization-scoped permission across units", () => {
    expect(
      hasPermission([{ permission: permissionKeys.unitRead }], permissionKeys.unitRead, {
        unitId: "unit-a"
      })
    ).toBe(true);
  });

  it("allows unit-scoped permission only for the same unit", () => {
    const assignments = [{ permission: permissionKeys.unitManage, unitId: "unit-a" }];

    expect(hasPermission(assignments, permissionKeys.unitManage, { unitId: "unit-a" })).toBe(true);
    expect(hasPermission(assignments, permissionKeys.unitManage, { unitId: "unit-b" })).toBe(false);
  });

  it("includes student permissions in the default owner role", () => {
    expect(listDefaultOwnerPermissions()).toContain(permissionKeys.studentRead);
    expect(listDefaultOwnerPermissions()).toContain(permissionKeys.studentManage);
  });
});
