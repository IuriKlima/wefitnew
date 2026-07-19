-- Narrow, read-only context discovery for the authenticated actor.
-- The API runtime must be a member of wefit_context_consumer, never of
-- wefit_context_reader. The reader is NOLOGIN and owns only this function.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'wefit_context_reader') THEN
    CREATE ROLE wefit_context_reader NOLOGIN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'wefit_context_consumer') THEN
    CREATE ROLE wefit_context_consumer NOLOGIN;
  END IF;
END
$$;

ALTER ROLE wefit_context_reader
  NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS NOLOGIN;

ALTER ROLE wefit_context_consumer
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOLOGIN;

GRANT USAGE ON SCHEMA public TO wefit_context_reader;
GRANT SELECT ON
  public."User",
  public."Organization",
  public."Unit",
  public."Membership",
  public."MembershipRole",
  public."Role"
TO wefit_context_reader;

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
  WITH actor AS (
    SELECT public."current_actor_user_id"() AS id
  )
  SELECT
    actor.id AS "userId",
    app_user.name AS "userName",
    organization.id AS "organizationId",
    COALESCE(organization."tradeName", organization."legalName") AS "organizationName",
    organization.type::text AS "organizationType",
    role.key AS "roleKey",
    role.name AS "roleName",
    membership_role."unitId" AS "roleUnitId",
    allowed_unit.id AS "unitId",
    allowed_unit.name AS "unitName",
    allowed_unit.code AS "unitCode"
  FROM actor
  LEFT JOIN public."User" AS app_user
    ON app_user.id = actor.id
    AND app_user."deletedAt" IS NULL
  LEFT JOIN public."Membership" AS membership
    ON membership."userId" = actor.id
    AND membership.status = 'ACTIVE'
    AND membership."deletedAt" IS NULL
  LEFT JOIN public."Organization" AS organization
    ON organization.id = membership."organizationId"
    AND organization."deletedAt" IS NULL
  LEFT JOIN public."MembershipRole" AS membership_role
    ON membership_role."organizationId" = organization.id
    AND membership_role."membershipId" = membership.id
  LEFT JOIN public."Role" AS role
    ON role."organizationId" = organization.id
    AND role.id = membership_role."roleId"
  LEFT JOIN LATERAL (
    SELECT unit.id, unit.name, unit.code
    FROM public."Unit" AS unit
    WHERE unit."organizationId" = organization.id
      AND unit."deletedAt" IS NULL
      AND (
        membership_role."unitId" IS NULL
        OR unit.id = membership_role."unitId"
      )
  ) AS allowed_unit ON membership_role.id IS NOT NULL
  WHERE actor.id IS NOT NULL
$$;

ALTER FUNCTION public."get_actor_context"() OWNER TO wefit_context_reader;
REVOKE ALL ON FUNCTION public."get_actor_context"() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public."get_actor_context"() TO wefit_context_consumer;
