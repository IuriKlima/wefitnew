import { describe, expect, it } from "vitest";

import {
  buildCurrentAccountContext,
  type AccountContextRow
} from "./account-context.repository.js";

const actorUserId = "11111111-1111-4111-8111-111111111111";
const otherUserId = "22222222-2222-4222-8222-222222222222";
const organizationAId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const organizationBId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const unitAId = "aaaaaaaa-1111-4111-8111-111111111111";
const unitBId = "aaaaaaaa-2222-4222-8222-222222222222";

describe("current account context mapping", () => {
  it("returns an empty organization list for an actor without membership", () => {
    const context = buildCurrentAccountContext(actorUserId, [row()]);

    expect(context).toEqual({
      user: { id: actorUserId, name: "Pessoa de teste" },
      organizations: []
    });
  });

  it("does not include rows belonging to another actor", () => {
    const context = buildCurrentAccountContext(actorUserId, [
      row({ organizationId: organizationAId, unitId: unitAId }),
      row({
        userId: otherUserId,
        organizationId: organizationBId,
        organizationName: "Tenant B",
        unitId: unitBId
      })
    ]);

    expect(context.organizations.map(({ id }) => id)).toEqual([organizationAId]);
  });

  it("does not expose an organization without a valid role", () => {
    const context = buildCurrentAccountContext(actorUserId, [
      row({ organizationId: organizationAId, roleKey: null, roleName: null, unitId: unitAId })
    ]);

    expect(context.organizations).toEqual([]);
  });

  it("does not expose an organization when a unit role has no active assigned unit", () => {
    const context = buildCurrentAccountContext(actorUserId, [
      row({ organizationId: organizationAId, roleUnitId: unitAId, unitId: null, unitName: null })
    ]);

    expect(context.organizations).toEqual([]);
  });

  it("limits a unit-scoped role to its assigned active unit", () => {
    const context = buildCurrentAccountContext(actorUserId, [
      row({ organizationId: organizationAId, roleUnitId: unitAId, unitId: unitAId }),
      row({ organizationId: organizationAId, roleUnitId: unitAId, unitId: unitBId })
    ]);

    expect(context.organizations[0]).toMatchObject({
      isGlobalMember: false,
      units: [{ id: unitAId }],
      roles: [{ scope: "UNIT", unitId: unitAId }]
    });
  });

  it("allows a global role to receive all active units without duplicates", () => {
    const context = buildCurrentAccountContext(actorUserId, [
      row({ organizationId: organizationAId, roleUnitId: null, unitId: unitAId }),
      row({ organizationId: organizationAId, roleUnitId: null, unitId: unitBId })
    ]);

    expect(context.organizations[0]).toMatchObject({
      isGlobalMember: true,
      units: [{ id: unitAId }, { id: unitBId }],
      roles: [{ scope: "ORGANIZATION" }]
    });
  });
});

function row(overrides: Partial<AccountContextRow> = {}): AccountContextRow {
  return {
    userId: actorUserId,
    userName: "Pessoa de teste",
    organizationId: null,
    organizationName: "Tenant A",
    organizationType: "GYM",
    roleKey: "manager",
    roleName: "Gerencia",
    roleUnitId: unitAId,
    unitId: null,
    unitName: "Unidade",
    unitCode: "MAIN",
    ...overrides
  };
}
