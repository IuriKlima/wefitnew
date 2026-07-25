import { describe, expect, it } from "vitest";

import type { ActiveAccountContext } from "@gym-platform/contracts";

import { buildAdminNavigation, canAccessStudents, canManageStudents } from "./navigation";

const activeContext: ActiveAccountContext = {
  organization: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Academia",
    type: "GYM",
    lifecycle: "ACTIVE",
    isGlobalMember: true,
    permissions: {
      organization: ["student:read"],
      units: {}
    },
    subscription: null,
    roles: [],
    units: []
  }
};

describe("admin navigation access", () => {
  it("shows students only when the active scope grants read access", () => {
    expect(buildAdminNavigation(activeContext, "/students").map(({ label }) => label)).toEqual([
      "Início",
      "Alunos"
    ]);

    expect(
      buildAdminNavigation(
        {
          ...activeContext,
          organization: {
            ...activeContext.organization,
            permissions: {
              organization: [],
              units: {}
            }
          }
        },
        "/"
      ).map(({ label }) => label)
    ).toEqual(["Início"]);
  });

  it("honors a unit-scoped permission only in the selected allowed unit", () => {
    const unitId = "22222222-2222-4222-8222-222222222222";
    const scopedContext: ActiveAccountContext = {
      organization: {
        ...activeContext.organization,
        isGlobalMember: false,
        permissions: {
          organization: [],
          units: {
            [unitId]: ["student:read"]
          }
        },
        units: [{ id: unitId, name: "Unidade", code: "MAIN", isAllowed: true }]
      },
      unit: { id: unitId, name: "Unidade", code: "MAIN", isAllowed: true }
    };

    expect(canAccessStudents(scopedContext)).toBe(true);
  });

  it("hides students when an effective plan disables the entitlement", () => {
    expect(
      canAccessStudents({
        ...activeContext,
        organization: {
          ...activeContext.organization,
          subscription: {
            planCode: "GYM",
            features: [{ key: "students.manage", enabled: false }]
          }
        }
      })
    ).toBe(false);
  });

  it("allows management only with an organization-level grant", () => {
    expect(canManageStudents(activeContext)).toBe(false);
    expect(
      canManageStudents({
        ...activeContext,
        organization: {
          ...activeContext.organization,
          permissions: {
            organization: ["student:read", "student:manage"],
            units: {}
          }
        }
      })
    ).toBe(true);
  });
});
