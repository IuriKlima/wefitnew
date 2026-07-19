import { ForbiddenException, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";

import { loadApiEnv } from "@gym-platform/config";
import { Prisma, PrismaClient } from "@gym-platform/database";
import { hasPermission, type PermissionKey } from "@gym-platform/permissions";

import { assertSafeRuntimeDatabasePosture } from "./runtime-database-posture.js";

export interface TenantContext {
  organizationId: string;
  unitId?: string;
  actorUserId?: string;
  correlationId?: string;
}

export type ActorDatabaseContext = Pick<TenantContext, "actorUserId" | "correlationId">;

export type TenantPermissionScope = "organization" | "contextual";

export interface AuthorizedTenantContext extends TenantContext {
  permission: PermissionKey | string;
  permissionScope?: TenantPermissionScope;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy, OnModuleInit {
  async onModuleInit(): Promise<void> {
    if (loadApiEnv().NODE_ENV !== "production") {
      return;
    }

    await this.$connect();

    const [posture] = await this.$queryRaw<
      Array<{
        isSuperuser: boolean;
        bypassesRls: boolean;
        inheritedElevatedRoleCount: number;
        ownedBusinessTableCount: number;
      }>
    >`
      SELECT
        role.rolsuper AS "isSuperuser",
        role.rolbypassrls AS "bypassesRls",
        (
          SELECT count(*)::integer
          FROM pg_catalog.pg_roles AS elevated_role
          WHERE elevated_role.oid <> role.oid
            AND pg_catalog.pg_has_role(role.oid, elevated_role.oid, 'MEMBER')
            AND (elevated_role.rolsuper OR elevated_role.rolbypassrls)
        ) AS "inheritedElevatedRoleCount",
        (
          SELECT count(*)::integer
          FROM pg_catalog.pg_class AS business_table
          INNER JOIN pg_catalog.pg_namespace AS business_schema
            ON business_schema.oid = business_table.relnamespace
          WHERE business_schema.nspname = 'public'
            AND business_table.relkind IN ('r', 'p')
            AND business_table.relname <> '_prisma_migrations'
            AND pg_catalog.pg_has_role(role.oid, business_table.relowner, 'MEMBER')
        ) AS "ownedBusinessTableCount"
      FROM pg_catalog.pg_roles AS role
      WHERE role.rolname = current_user
    `;

    if (!posture) {
      throw new Error("Unable to verify the production runtime database role.");
    }

    assertSafeRuntimeDatabasePosture(posture);
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async withTenantContext<T>(
    context: TenantContext,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    }
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await setDatabaseContext(tx, context);
      return fn(tx);
    }, options);
  }

  async withActorContext<T>(
    context: ActorDatabaseContext,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    }
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await setDatabaseContext(tx, context);
      return fn(tx);
    }, options);
  }

  /**
   * Repeats the permission check in the same transaction that runs the use case.
   * Route and header tenant values are candidates only; RLS visibility is additionally
   * constrained by the authenticated actor before the callback receives a client.
   */
  async withAuthorizedTenantTransaction<T>(
    context: AuthorizedTenantContext,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    }
  ): Promise<T> {
    if (!context.actorUserId) {
      throw new ForbiddenException("Authenticated actor is required.");
    }

    const unitId = context.permissionScope === "organization" ? undefined : context.unitId;
    const effectiveContext = {
      organizationId: context.organizationId,
      actorUserId: context.actorUserId,
      ...(context.correlationId ? { correlationId: context.correlationId } : {}),
      ...(unitId ? { unitId } : {})
    };

    return this.$transaction(async (tx) => {
      await setDatabaseContext(tx, effectiveContext);

      const allowed = await hasTenantPermission(tx, {
        actorUserId: context.actorUserId!,
        organizationId: context.organizationId,
        permission: context.permission,
        ...(unitId ? { unitId } : {})
      });

      if (!allowed) {
        throw new ForbiddenException("Permission denied.");
      }

      return fn(tx);
    }, options);
  }

  /**
   * Guard pre-check. Sensitive work must still use withAuthorizedTenantTransaction,
   * because a guard transaction cannot be kept open across the Nest request handler.
   */
  async canInTenantContext(context: AuthorizedTenantContext): Promise<boolean> {
    if (!context.actorUserId) {
      return false;
    }

    const unitId = context.permissionScope === "organization" ? undefined : context.unitId;

    return this.withTenantContext(
      {
        organizationId: context.organizationId,
        actorUserId: context.actorUserId,
        ...(context.correlationId ? { correlationId: context.correlationId } : {}),
        ...(unitId ? { unitId } : {})
      },
      (tx) =>
        hasTenantPermission(tx, {
          actorUserId: context.actorUserId!,
          organizationId: context.organizationId,
          permission: context.permission,
          ...(unitId ? { unitId } : {})
        })
    );
  }
}

async function setDatabaseContext(
  tx: Prisma.TransactionClient,
  context: ActorDatabaseContext & Partial<Pick<TenantContext, "organizationId" | "unitId">>
): Promise<void> {
  await tx.$executeRaw`
    SELECT
      set_config('app.organization_id', ${context.organizationId || ""}, true),
      set_config('app.unit_id', ${context.unitId || ""}, true),
      set_config('app.actor_user_id', ${context.actorUserId || ""}, true),
      set_config('app.correlation_id', ${context.correlationId || ""}, true)
  `;
}

async function hasTenantPermission(
  tx: Prisma.TransactionClient,
  input: {
    actorUserId: string;
    organizationId: string;
    permission: PermissionKey | string;
    unitId?: string;
  }
): Promise<boolean> {
  const membership = await tx.membership.findFirst({
    where: {
      userId: input.actorUserId,
      organizationId: input.organizationId,
      status: "ACTIVE",
      deletedAt: null
    },
    include: {
      membershipRoles: {
        where: {
          organizationId: input.organizationId
        },
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!membership) {
    return false;
  }

  const assignments = membership.membershipRoles.flatMap((membershipRole) =>
    membershipRole.role.rolePermissions.map((rolePermission) => ({
      permission: rolePermission.permission.key,
      unitId: membershipRole.unitId
    }))
  );

  return hasPermission(assignments, input.permission, input.unitId ? { unitId: input.unitId } : {});
}
