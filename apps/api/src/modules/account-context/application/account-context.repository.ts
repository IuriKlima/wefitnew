import { Inject, Injectable } from "@nestjs/common";

import type {
  AccountContextOrganization,
  AccountOrganizationLifecycle,
  AccountOrganizationType,
  CurrentAccountContext
} from "@gym-platform/contracts";

import { PrismaService } from "../../../infrastructure/database/prisma.service.js";

export type AccountContextRow = {
  userId: string;
  userName: string | null;
  organizationId: string | null;
  organizationName: string | null;
  organizationType: AccountOrganizationType | null;
  organizationLifecycle: AccountOrganizationLifecycle | null;
  roleKey: string | null;
  roleName: string | null;
  roleUnitId: string | null;
  unitId: string | null;
  unitName: string | null;
  unitCode: string | null;
  permissionKey: string | null;
  planCode: string | null;
  featureKey: string | null;
  featureEnabled: boolean | null;
  featureLimitValue: number | null;
  featureConfig: unknown;
};

@Injectable()
export class AccountContextRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  findByActor(actorUserId: string, correlationId: string): Promise<CurrentAccountContext> {
    return this.prisma.withActorContext(
      {
        actorUserId,
        ...(correlationId ? { correlationId } : {})
      },
      async (tx) => {
        const rows = await tx.$queryRaw<AccountContextRow[]>`
          SELECT * FROM public."get_actor_context"()
        `;

        return buildCurrentAccountContext(actorUserId, rows);
      }
    );
  }
}

export function buildCurrentAccountContext(
  actorUserId: string,
  rows: AccountContextRow[]
): CurrentAccountContext {
  const actorRows = rows.filter((row) => row.userId === actorUserId);
  const organizations = new Map<
    string,
    {
      value: AccountContextOrganization;
      featureKeys: Set<string>;
      organizationPermissionKeys: Set<string>;
      unitPermissionKeys: Map<string, Set<string>>;
      roleKeys: Set<string>;
      unitIds: Set<string>;
    }
  >();

  for (const row of actorRows) {
    if (
      !row.organizationId ||
      !row.organizationName ||
      !row.organizationType ||
      !row.organizationLifecycle ||
      !row.roleKey ||
      !row.roleName ||
      !row.unitId ||
      !row.unitName
    ) {
      continue;
    }

    let organization = organizations.get(row.organizationId);
    if (!organization) {
      organization = {
        value: {
          id: row.organizationId,
          name: row.organizationName,
          type: row.organizationType,
          lifecycle: row.organizationLifecycle,
          isGlobalMember: false,
          permissions: {
            organization: [],
            units: {}
          },
          subscription: row.planCode
            ? {
                planCode: row.planCode,
                features: []
              }
            : null,
          roles: [],
          units: []
        },
        featureKeys: new Set(),
        organizationPermissionKeys: new Set(),
        unitPermissionKeys: new Map(),
        roleKeys: new Set(),
        unitIds: new Set()
      };
      organizations.set(row.organizationId, organization);
    }

    if (!organization.unitIds.has(row.unitId)) {
      organization.unitIds.add(row.unitId);
      organization.value.units.push({
        id: row.unitId,
        name: row.unitName,
        code: row.unitCode,
        isAllowed: true
      });
    }

    const isGlobalRole = row.roleUnitId === null;
    const isActiveUnitRole = row.roleUnitId !== null && row.roleUnitId === row.unitId;

    if (isGlobalRole || isActiveUnitRole) {
      const roleIdentity = `${row.roleKey}:${row.roleUnitId ?? "organization"}`;
      if (!organization.roleKeys.has(roleIdentity)) {
        organization.roleKeys.add(roleIdentity);
        organization.value.roles.push({
          key: row.roleKey,
          name: row.roleName,
          scope: isGlobalRole ? "ORGANIZATION" : "UNIT",
          ...(row.roleUnitId ? { unitId: row.roleUnitId } : {})
        });
      }

      if (row.permissionKey) {
        if (isGlobalRole) {
          organization.organizationPermissionKeys.add(row.permissionKey);
        } else if (row.roleUnitId) {
          const permissionKeys =
            organization.unitPermissionKeys.get(row.roleUnitId) ?? new Set<string>();
          permissionKeys.add(row.permissionKey);
          organization.unitPermissionKeys.set(row.roleUnitId, permissionKeys);
        }
      }
    }

    if (
      organization.value.subscription &&
      row.featureKey &&
      !organization.featureKeys.has(row.featureKey)
    ) {
      organization.featureKeys.add(row.featureKey);
      organization.value.subscription.features.push({
        key: row.featureKey,
        enabled: row.featureEnabled ?? false,
        limitValue: row.featureLimitValue,
        config: toFeatureConfig(row.featureConfig)
      });
    }

    organization.value.isGlobalMember ||= isGlobalRole;
  }

  const organizationValues = [...organizations.values()].map(
    ({ value, organizationPermissionKeys, unitPermissionKeys }) => {
      if (!value.isGlobalMember) {
        const scopedUnitIds = new Set(
          value.roles.flatMap((role) => (role.scope === "UNIT" && role.unitId ? [role.unitId] : []))
        );
        value.units = value.units.filter((unit) => scopedUnitIds.has(unit.id));
      }

      value.permissions.organization = [...organizationPermissionKeys].sort();
      value.permissions.units = Object.fromEntries(
        value.units.map((unit) => [unit.id, [...(unitPermissionKeys.get(unit.id) ?? [])].sort()])
      );
      value.subscription?.features.sort((left, right) => left.key.localeCompare(right.key));
      value.roles.sort((left, right) =>
        `${left.scope}:${left.name}`.localeCompare(`${right.scope}:${right.name}`, "pt-BR")
      );
      value.units.sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
      return value;
    }
  );
  organizationValues.sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));

  return {
    user: {
      id: actorUserId,
      name: actorRows.find((row) => row.userName)?.userName ?? null
    },
    organizations: organizationValues
  };
}

function toFeatureConfig(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}
