import { describe, expect, it } from "vitest";

import type { ActiveAccountContext } from "@gym-platform/contracts";

import {
  buildAdminNavigation,
  canAccessStudents,
  canManageStudents,
  hasPermissionInActiveScope
} from "./navigation";

const unitId = "22222222-2222-4222-8222-222222222222";
const ownerPermissions = [
  "organization:read",
  "organization:manage",
  "unit:read",
  "unit:manage",
  "student:read",
  "student:manage",
  "membership:manage",
  "subscription:read",
  "audit:read"
];

const activeContext: ActiveAccountContext = {
  organization: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Academia",
    type: "GYM",
    lifecycle: "ACTIVE",
    isGlobalMember: true,
    permissions: {
      organization: ownerPermissions,
      units: {}
    },
    subscription: null,
    roles: [],
    units: [{ id: unitId, name: "Unidade", code: "MAIN", isAllowed: true }]
  }
};

describe("admin navigation access", () => {
  it("groups modules and marks previews without presenting them as functional", () => {
    const navigation = buildAdminNavigation(activeContext, "/crm");
    const items = navigation.flatMap((section) => section.items);

    expect(navigation.map(({ label }) => label)).toEqual([
      "Visão geral",
      "Operação",
      "Comercial",
      "Treinos e saúde",
      "Gestão",
      "Acesso",
      "Administração"
    ]);
    expect(items.find(({ label }) => label === "CRM")).toMatchObject({
      badge: "Preview",
      badgeTone: "info",
      isActive: true
    });
    expect(items.find(({ label }) => label === "Agenda")).toMatchObject({
      badge: "Bloqueado",
      badgeTone: "warning"
    });
  });

  it("filters modules that are incompatible with the Personal plan", () => {
    const personal = {
      ...activeContext,
      organization: {
        ...activeContext.organization,
        type: "PERSONAL" as const,
        subscription: {
          planCode: "PERSONAL",
          features: [{ key: "students.manage", enabled: true }]
        }
      }
    };
    const labels = buildAdminNavigation(personal, "/").flatMap(({ items }) =>
      items.map(({ label }) => label)
    );

    expect(labels).toContain("Alunos");
    expect(labels).toContain("Treinos");
    expect(labels).not.toContain("Equipe");
    expect(labels).not.toContain("Unidades");
    expect(labels).not.toContain("Financeiro");
    expect(labels).not.toContain("Controle de acesso");
  });

  it("filters modules by effective permissions instead of role names", () => {
    const membershipManager: ActiveAccountContext = {
      ...activeContext,
      organization: {
        ...activeContext.organization,
        permissions: {
          organization: ["membership:manage"],
          units: {}
        },
        roles: [{ key: "custom-role", name: "Papel customizado", scope: "ORGANIZATION" }]
      }
    };
    const labels = buildAdminNavigation(membershipManager, "/team").flatMap(({ items }) =>
      items.map(({ label }) => label)
    );

    expect(labels).toContain("Equipe");
    expect(labels).not.toContain("Alunos");
    expect(labels).not.toContain("Financeiro");
  });

  it("honors a unit-scoped permission only in the selected allowed unit", () => {
    const scopedContext: ActiveAccountContext = {
      organization: {
        ...activeContext.organization,
        isGlobalMember: false,
        permissions: {
          organization: [],
          units: {
            [unitId]: ["student:read"]
          }
        }
      },
      unit: activeContext.organization.units[0]!
    };

    expect(hasPermissionInActiveScope(scopedContext, "student:read")).toBe(true);
    expect(canAccessStudents(scopedContext)).toBe(true);
  });

  it("marks an entitlement-disabled module as blocked", () => {
    const blockedContext: ActiveAccountContext = {
      ...activeContext,
      organization: {
        ...activeContext.organization,
        subscription: {
          planCode: "GYM",
          features: [{ key: "students.manage", enabled: false }]
        }
      }
    };
    const students = buildAdminNavigation(blockedContext, "/students")
      .flatMap(({ items }) => items)
      .find(({ label }) => label === "Alunos");

    expect(students).toMatchObject({ badge: "Bloqueado", badgeTone: "warning" });
    expect(canAccessStudents(blockedContext)).toBe(false);
  });

  it("allows student management only with an organization-level grant", () => {
    const unitManager: ActiveAccountContext = {
      ...activeContext,
      organization: {
        ...activeContext.organization,
        permissions: {
          organization: ["student:read"],
          units: { [unitId]: ["student:manage"] }
        }
      },
      unit: activeContext.organization.units[0]!
    };

    expect(canManageStudents(unitManager)).toBe(false);
    expect(canManageStudents(activeContext)).toBe(true);
  });
});
