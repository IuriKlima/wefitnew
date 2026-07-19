import { Inject, Injectable } from "@nestjs/common";

import type {
  AccountContextOrganization,
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
  roleKey: string | null;
  roleName: string | null;
  roleUnitId: string | null;
  unitId: string | null;
  unitName: string | null;
  unitCode: string | null;
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
      roleKeys: Set<string>;
      unitIds: Set<string>;
    }
  >();

  for (const row of actorRows) {
    if (!row.organizationId || !row.organizationName || !row.organizationType) {
      continue;
    }

    let organization = organizations.get(row.organizationId);
    if (!organization) {
      organization = {
        value: {
          id: row.organizationId,
          name: row.organizationName,
          type: row.organizationType,
          isGlobalMember: false,
          roles: [],
          units: []
        },
        roleKeys: new Set(),
        unitIds: new Set()
      };
      organizations.set(row.organizationId, organization);
    }

    if (row.unitId && row.unitName && !organization.unitIds.has(row.unitId)) {
      organization.unitIds.add(row.unitId);
      organization.value.units.push({
        id: row.unitId,
        name: row.unitName,
        code: row.unitCode,
        isAllowed: true
      });
    }

    if (row.roleKey && row.roleName) {
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
      }

      organization.value.isGlobalMember ||= isGlobalRole;
    }
  }

  const organizationValues = [...organizations.values()].map(({ value }) => {
    if (!value.isGlobalMember) {
      const scopedUnitIds = new Set(
        value.roles.flatMap((role) => (role.scope === "UNIT" && role.unitId ? [role.unitId] : []))
      );
      value.units = value.units.filter((unit) => scopedUnitIds.has(unit.id));
    }

    value.roles.sort((left, right) =>
      `${left.scope}:${left.name}`.localeCompare(`${right.scope}:${right.name}`, "pt-BR")
    );
    value.units.sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
    return value;
  });
  organizationValues.sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));

  return {
    user: {
      id: actorUserId,
      name: actorRows.find((row) => row.userName)?.userName ?? null
    },
    organizations: organizationValues
  };
}
