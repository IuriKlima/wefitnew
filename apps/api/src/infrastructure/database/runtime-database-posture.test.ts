import { describe, expect, it } from "vitest";

import { assertSafeRuntimeDatabasePosture } from "./runtime-database-posture.js";

describe("runtime database posture", () => {
  it("accepts a least-privilege runtime role", () => {
    expect(() =>
      assertSafeRuntimeDatabasePosture({
        isSuperuser: false,
        bypassesRls: false,
        inheritedElevatedRoleCount: 0,
        ownedBusinessTableCount: 0
      })
    ).not.toThrow();
  });

  it.each([
    {
      isSuperuser: true,
      bypassesRls: false,
      inheritedElevatedRoleCount: 0,
      ownedBusinessTableCount: 0
    },
    {
      isSuperuser: false,
      bypassesRls: true,
      inheritedElevatedRoleCount: 0,
      ownedBusinessTableCount: 0
    },
    {
      isSuperuser: false,
      bypassesRls: false,
      inheritedElevatedRoleCount: 1,
      ownedBusinessTableCount: 0
    },
    {
      isSuperuser: false,
      bypassesRls: false,
      inheritedElevatedRoleCount: 0,
      ownedBusinessTableCount: 1
    }
  ])("rejects an unsafe runtime role: %o", (posture) => {
    expect(() => assertSafeRuntimeDatabasePosture(posture)).toThrow("Unsafe runtime database role");
  });
});
