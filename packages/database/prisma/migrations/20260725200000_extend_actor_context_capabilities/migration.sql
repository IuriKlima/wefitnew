-- Exposes only the authenticated actor's effective permission scopes and subscription
-- entitlements to trusted account-context consumers. The runtime never receives direct
-- table access and cannot supply an arbitrary actor identifier to this function.

GRANT SELECT ON
  public."Permission",
  public."RolePermission",
  public."OrganizationSubscription",
  public."SubscriptionPlan",
  public."PlanFeature",
  public."Feature"
TO wefit_context_reader;

DROP FUNCTION public."get_actor_context"();

CREATE FUNCTION public."get_actor_context"()
RETURNS TABLE (
  "userId" uuid,
  "userName" text,
  "organizationId" uuid,
  "organizationName" text,
  "organizationType" text,
  "organizationLifecycle" text,
  "roleKey" text,
  "roleName" text,
  "roleUnitId" uuid,
  "unitId" uuid,
  "unitName" text,
  "unitCode" text,
  "permissionKey" text,
  "planCode" text,
  "featureKey" text,
  "featureEnabled" boolean,
  "featureLimitValue" integer,
  "featureConfig" jsonb
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
    actor_context."organizationLifecycle",
    actor_context."roleKey",
    actor_context."roleName",
    actor_context."roleUnitId",
    actor_context."unitId",
    actor_context."unitName",
    actor_context."unitCode",
    actor_context."permissionKey",
    actor_context."planCode",
    actor_context."featureKey",
    actor_context."featureEnabled",
    actor_context."featureLimitValue",
    actor_context."featureConfig"
  FROM actor_user
  LEFT JOIN LATERAL (
    SELECT
      organization.id AS "organizationId",
      COALESCE(organization."tradeName", organization."legalName") AS "organizationName",
      organization.type::text AS "organizationType",
      organization.lifecycle::text AS "organizationLifecycle",
      role.key AS "roleKey",
      role.name AS "roleName",
      membership_role."unitId" AS "roleUnitId",
      allowed_unit.id AS "unitId",
      allowed_unit.name AS "unitName",
      allowed_unit.code AS "unitCode",
      permission.key AS "permissionKey",
      entitlement."planCode",
      entitlement."featureKey",
      entitlement."featureEnabled",
      entitlement."featureLimitValue",
      entitlement."featureConfig"
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
    LEFT JOIN public."RolePermission" AS role_permission
      ON role_permission."organizationId" = organization.id
      AND role_permission."roleId" = role.id
    LEFT JOIN public."Permission" AS permission
      ON permission.id = role_permission."permissionId"
    LEFT JOIN LATERAL (
      SELECT
        selected_subscription."planCode",
        feature.key AS "featureKey",
        plan_feature.enabled AS "featureEnabled",
        plan_feature."limitValue" AS "featureLimitValue",
        plan_feature.config AS "featureConfig"
      FROM (
        SELECT
          organization_subscription."planId",
          subscription_plan.code AS "planCode"
        FROM public."OrganizationSubscription" AS organization_subscription
        INNER JOIN public."SubscriptionPlan" AS subscription_plan
          ON subscription_plan.id = organization_subscription."planId"
          AND subscription_plan.active = true
        WHERE organization_subscription."organizationId" = organization.id
          AND organization_subscription.status IN ('TRIALING', 'ACTIVE')
          AND organization_subscription."startsAt" <= statement_timestamp()
          AND (
            organization_subscription."endsAt" IS NULL
            OR organization_subscription."endsAt" > statement_timestamp()
          )
        ORDER BY organization_subscription."startsAt" DESC
        LIMIT 1
      ) AS selected_subscription
      LEFT JOIN public."PlanFeature" AS plan_feature
        ON plan_feature."planId" = selected_subscription."planId"
      LEFT JOIN public."Feature" AS feature
        ON feature.id = plan_feature."featureId"
    ) AS entitlement ON true
    WHERE membership."userId" = actor_user.id
      AND membership.status = 'ACTIVE'
      AND membership."deletedAt" IS NULL
  ) AS actor_context ON true
$$;

ALTER FUNCTION public."get_actor_context"() OWNER TO wefit_context_reader;
REVOKE ALL ON FUNCTION public."get_actor_context"() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public."get_actor_context"() TO wefit_context_consumer;
