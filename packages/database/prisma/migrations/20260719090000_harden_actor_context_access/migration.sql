-- Complements the authenticated account context without rewriting an applied migration.
-- The runtime may inherit wefit_context_consumer, but must never inherit the reader role.

ALTER ROLE wefit_context_consumer
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOLOGIN;

GRANT USAGE ON SCHEMA public TO wefit_context_consumer;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM wefit_context_consumer;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM wefit_context_consumer;
REVOKE wefit_context_reader FROM wefit_context_consumer;

CREATE OR REPLACE FUNCTION public."has_global_scope"(target_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT target_organization_id IS NOT NULL
    AND target_organization_id = public."current_organization_id"()
    AND EXISTS (
      SELECT 1
      FROM public."User" AS app_user
      INNER JOIN public."Membership" AS membership
        ON membership."userId" = app_user.id
        AND membership."organizationId" = target_organization_id
        AND membership.status = 'ACTIVE'
        AND membership."deletedAt" IS NULL
      INNER JOIN public."Organization" AS organization
        ON organization.id = membership."organizationId"
        AND organization."deletedAt" IS NULL
      INNER JOIN public."MembershipRole" AS membership_role
        ON membership_role."organizationId" = organization.id
        AND membership_role."membershipId" = membership.id
        AND membership_role."unitId" IS NULL
      INNER JOIN public."Role" AS role
        ON role."organizationId" = organization.id
        AND role.id = membership_role."roleId"
      WHERE app_user.id = public."current_actor_user_id"()
        AND app_user."deletedAt" IS NULL
    )
$$;

ALTER FUNCTION public."has_global_scope"(uuid) OWNER TO wefit_rls_owner;
REVOKE EXECUTE ON FUNCTION public."has_global_scope"(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public."can_access_unit"(
  target_organization_id uuid,
  target_unit_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT target_organization_id IS NOT NULL
    AND target_unit_id IS NOT NULL
    AND target_organization_id = public."current_organization_id"()
    AND EXISTS (
      SELECT 1
      FROM public."User" AS app_user
      INNER JOIN public."Membership" AS membership
        ON membership."userId" = app_user.id
        AND membership."organizationId" = target_organization_id
        AND membership.status = 'ACTIVE'
        AND membership."deletedAt" IS NULL
      INNER JOIN public."Organization" AS organization
        ON organization.id = membership."organizationId"
        AND organization."deletedAt" IS NULL
      INNER JOIN public."Unit" AS unit
        ON unit.id = target_unit_id
        AND unit."organizationId" = organization.id
        AND unit."deletedAt" IS NULL
      INNER JOIN public."MembershipRole" AS membership_role
        ON membership_role."organizationId" = organization.id
        AND membership_role."membershipId" = membership.id
        AND (
          membership_role."unitId" IS NULL
          OR membership_role."unitId" = unit.id
        )
      INNER JOIN public."Role" AS role
        ON role."organizationId" = organization.id
        AND role.id = membership_role."roleId"
      WHERE app_user.id = public."current_actor_user_id"()
        AND app_user."deletedAt" IS NULL
    )
$$;

ALTER FUNCTION public."can_access_unit"(uuid, uuid) OWNER TO wefit_rls_owner;
REVOKE EXECUTE ON FUNCTION public."can_access_unit"(uuid, uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public."get_actor_context"()
RETURNS TABLE (
  "userId" uuid,
  "userName" text,
  "organizationId" uuid,
  "organizationName" text,
  "organizationType" text,
  "roleKey" text,
  "roleName" text,
  "roleUnitId" uuid,
  "unitId" uuid,
  "unitName" text,
  "unitCode" text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH actor_user AS (
    SELECT app_user.id, app_user.name
    FROM public."User" AS app_user
    WHERE app_user.id = public."current_actor_user_id"()
      AND app_user."deletedAt" IS NULL
  )
  SELECT
    actor_user.id AS "userId",
    actor_user.name AS "userName",
    actor_context."organizationId",
    actor_context."organizationName",
    actor_context."organizationType",
    actor_context."roleKey",
    actor_context."roleName",
    actor_context."roleUnitId",
    actor_context."unitId",
    actor_context."unitName",
    actor_context."unitCode"
  FROM actor_user
  LEFT JOIN LATERAL (
    SELECT
      organization.id AS "organizationId",
      COALESCE(organization."tradeName", organization."legalName") AS "organizationName",
      organization.type::text AS "organizationType",
      role.key AS "roleKey",
      role.name AS "roleName",
      membership_role."unitId" AS "roleUnitId",
      allowed_unit.id AS "unitId",
      allowed_unit.name AS "unitName",
      allowed_unit.code AS "unitCode"
    FROM public."Membership" AS membership
    INNER JOIN public."Organization" AS organization
      ON organization.id = membership."organizationId"
      AND organization."deletedAt" IS NULL
    INNER JOIN public."MembershipRole" AS membership_role
      ON membership_role."organizationId" = organization.id
      AND membership_role."membershipId" = membership.id
    INNER JOIN public."Role" AS role
      ON role."organizationId" = organization.id
      AND role.id = membership_role."roleId"
    INNER JOIN LATERAL (
      SELECT unit.id, unit.name, unit.code
      FROM public."Unit" AS unit
      WHERE unit."organizationId" = organization.id
        AND unit."deletedAt" IS NULL
        AND (
          membership_role."unitId" IS NULL
          OR unit.id = membership_role."unitId"
        )
    ) AS allowed_unit ON true
    WHERE membership."userId" = actor_user.id
      AND membership.status = 'ACTIVE'
      AND membership."deletedAt" IS NULL
  ) AS actor_context ON true
$$;

ALTER FUNCTION public."get_actor_context"() OWNER TO wefit_context_reader;
REVOKE ALL ON FUNCTION public."get_actor_context"() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public."get_actor_context"() TO wefit_context_consumer;
