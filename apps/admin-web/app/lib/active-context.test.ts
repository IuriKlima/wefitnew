import { describe, expect, it } from "vitest";

import type { CurrentAccountContext } from "@gym-platform/contracts";

import { resolveActiveAccountContext } from "./active-context";

const organizationAId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const organizationBId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const unitAId = "aaaaaaaa-1111-4111-8111-111111111111";
const unitBId = "bbbbbbbb-2222-4222-8222-222222222222";

describe("active account context", () => {
  it("returns no active context when the actor has no memberships", () => {
    expect(resolveActiveAccountContext(context([]), {})).toBeNull();
  });

  it("rejects organization and unit cookie values outside the actor context", () => {
    const active = resolveActiveAccountContext(context([organization(false)]), {
      organizationId: organizationBId,
      unitId: unitBId
    });

    expect(active).toMatchObject({
      organization: { id: organizationAId },
      unit: { id: unitAId }
    });
  });

  it("allows a global member to select organization-wide scope", () => {
    const active = resolveActiveAccountContext(context([organization(true)]), {
      organizationId: organizationAId
    });

    expect(active?.organization.id).toBe(organizationAId);
    expect(active?.unit).toBeUndefined();
  });
});

function context(organizations: CurrentAccountContext["organizations"]): CurrentAccountContext {
  return {
    user: { id: "11111111-1111-4111-8111-111111111111", name: "Pessoa" },
    organizations
  };
}

function organization(isGlobalMember: boolean): CurrentAccountContext["organizations"][number] {
  return {
    id: organizationAId,
    name: "Tenant A",
    type: "GYM",
    lifecycle: "ACTIVE",
    isGlobalMember,
    roles: [],
    units: [{ id: unitAId, name: "Unidade A", code: "A", isAllowed: true }]
  };
}
