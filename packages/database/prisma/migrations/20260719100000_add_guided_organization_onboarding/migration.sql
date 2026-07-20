CREATE TYPE public."OrganizationLifecycle" AS ENUM ('ONBOARDING', 'ACTIVE', 'SUSPENDED');
CREATE TYPE public."OnboardingStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELED');

ALTER TABLE public."Organization"
  ADD COLUMN "lifecycle" public."OrganizationLifecycle" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "cnpj" text,
  ADD COLUMN "businessEmail" text,
  ADD COLUMN "businessPhone" text;

ALTER TABLE public."Unit"
  ADD COLUMN "phone" text,
  ADD COLUMN "postalCode" text,
  ADD COLUMN "street" text,
  ADD COLUMN "streetNumber" text,
  ADD COLUMN "addressExtra" text,
  ADD COLUMN "neighborhood" text,
  ADD COLUMN "city" text,
  ADD COLUMN "state" text,
  ADD COLUMN "country" text NOT NULL DEFAULT 'BR',
  ADD COLUMN "openingHours" jsonb;

CREATE TABLE public."OrganizationOnboarding" (
  "id" uuid NOT NULL,
  "organizationId" uuid NOT NULL,
  "createdByUserId" uuid NOT NULL,
  "status" public."OnboardingStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "currentStep" integer NOT NULL DEFAULT 1,
  "selectedPlanCode" text,
  "payload" jsonb NOT NULL,
  "payloadVersion" integer NOT NULL DEFAULT 1,
  "version" integer NOT NULL DEFAULT 1,
  "completedAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  "deletedAt" timestamp(3),
  CONSTRAINT "OrganizationOnboarding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganizationOnboarding_currentStep_check"
    CHECK ("currentStep" BETWEEN 1 AND 7),
  CONSTRAINT "OrganizationOnboarding_payloadVersion_check"
    CHECK ("payloadVersion" = 1),
  CONSTRAINT "OrganizationOnboarding_version_check"
    CHECK ("version" > 0),
  CONSTRAINT "OrganizationOnboarding_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES public."Organization"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OrganizationOnboarding_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES public."User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OrganizationOnboarding_organizationId_id_key"
    UNIQUE ("organizationId", "id")
);

CREATE INDEX "Organization_lifecycle_deletedAt_idx"
  ON public."Organization"("lifecycle", "deletedAt");
CREATE UNIQUE INDEX "Organization_active_cnpj_key"
  ON public."Organization"("cnpj")
  WHERE "cnpj" IS NOT NULL AND "deletedAt" IS NULL;
CREATE INDEX "OrganizationOnboarding_organizationId_status_deletedAt_idx"
  ON public."OrganizationOnboarding"("organizationId", "status", "deletedAt");
CREATE INDEX "OrganizationOnboarding_createdByUserId_status_deletedAt_idx"
  ON public."OrganizationOnboarding"("createdByUserId", "status", "deletedAt");
CREATE INDEX "OrganizationOnboarding_status_updatedAt_idx"
  ON public."OrganizationOnboarding"("status", "updatedAt");
CREATE UNIQUE INDEX "OrganizationOnboarding_one_active_per_organization_key"
  ON public."OrganizationOnboarding"("organizationId")
  WHERE "status" = 'IN_PROGRESS' AND "deletedAt" IS NULL;
CREATE UNIQUE INDEX "OrganizationOnboarding_one_active_per_actor_key"
  ON public."OrganizationOnboarding"("createdByUserId")
  WHERE "status" = 'IN_PROGRESS' AND "deletedAt" IS NULL;

INSERT INTO public."Permission" ("id", "key", "description", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'organization:read', 'Allows organization:read.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'organization:manage', 'Allows organization:manage.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'unit:read', 'Allows unit:read.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'unit:manage', 'Allows unit:manage.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'student:read', 'Allows student:read.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'student:manage', 'Allows student:manage.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'membership:manage', 'Allows membership:manage.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'subscription:read', 'Allows subscription:read.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'audit:read', 'Allows audit:read.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'wefit_onboarding_owner'
  ) THEN
    CREATE ROLE wefit_onboarding_owner NOLOGIN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'wefit_onboarding_consumer'
  ) THEN
    CREATE ROLE wefit_onboarding_consumer NOLOGIN;
  END IF;
END
$$;

ALTER ROLE wefit_onboarding_owner
  NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS NOLOGIN;
ALTER ROLE wefit_onboarding_consumer
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOLOGIN;

GRANT USAGE ON SCHEMA public TO wefit_onboarding_owner, wefit_onboarding_consumer;
GRANT EXECUTE ON FUNCTION public."current_actor_user_id"() TO wefit_onboarding_owner;
GRANT SELECT ON public."Permission" TO wefit_onboarding_owner;
GRANT SELECT, INSERT ON
  public."User",
  public."Organization",
  public."Unit",
  public."Membership",
  public."Role",
  public."MembershipRole",
  public."RolePermission",
  public."OrganizationOnboarding",
  public."AuditLog"
TO wefit_onboarding_owner;

CREATE FUNCTION public."start_actor_onboarding"(
  actor_email text,
  actor_name text,
  request_correlation_id text
)
RETURNS TABLE (
  "onboardingId" uuid,
  "organizationId" uuid,
  "status" text,
  "currentStep" integer,
  "version" integer
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  actor_id uuid := public."current_actor_user_id"();
  normalized_email text := NULLIF(lower(btrim(actor_email)), '');
  normalized_name text := NULLIF(btrim(actor_name), '');
  actor_record public."User"%ROWTYPE;
  existing_onboarding public."OrganizationOnboarding"%ROWTYPE;
  new_organization_id uuid := gen_random_uuid();
  new_unit_id uuid := gen_random_uuid();
  new_role_id uuid := gen_random_uuid();
  new_membership_id uuid := gen_random_uuid();
  new_onboarding_id uuid := gen_random_uuid();
  inserted_permission_count integer := 0;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'onboarding_actor_required';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor_id::text, 20260719)
  );

  SELECT app_user.*
  INTO actor_record
  FROM public."User" AS app_user
  WHERE app_user.id = actor_id;

  IF FOUND AND actor_record."deletedAt" IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'onboarding_actor_inactive';
  END IF;

  SELECT onboarding.*
  INTO existing_onboarding
  FROM public."OrganizationOnboarding" AS onboarding
  INNER JOIN public."Organization" AS organization
    ON organization.id = onboarding."organizationId"
    AND organization."deletedAt" IS NULL
  WHERE onboarding."createdByUserId" = actor_id
    AND onboarding."deletedAt" IS NULL
  ORDER BY onboarding."createdAt" DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT
      existing_onboarding.id,
      existing_onboarding."organizationId",
      existing_onboarding.status::text,
      existing_onboarding."currentStep",
      existing_onboarding.version;
    RETURN;
  END IF;

  IF actor_record.id IS NULL THEN
    IF normalized_email IS NULL OR normalized_name IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'onboarding_identity_incomplete';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public."User" AS app_user
      WHERE lower(app_user.email) = normalized_email
        AND app_user.id <> actor_id
    ) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'onboarding_identity_conflict';
    END IF;

    INSERT INTO public."User" (
      "id", "name", "email", "createdAt", "updatedAt"
    ) VALUES (
      actor_id, normalized_name, normalized_email, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    RETURNING * INTO actor_record;
  ELSIF normalized_email IS NOT NULL AND lower(actor_record.email) <> normalized_email THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'onboarding_identity_conflict';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public."Membership" AS membership
    INNER JOIN public."Organization" AS organization
      ON organization.id = membership."organizationId"
      AND organization."deletedAt" IS NULL
    WHERE membership."userId" = actor_id
      AND membership.status = 'ACTIVE'
      AND membership."deletedAt" IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'onboarding_actor_not_eligible';
  END IF;

  INSERT INTO public."Organization" (
    "id", "type", "lifecycle", "legalName", "tradeName", "slug", "timezone",
    "createdAt", "updatedAt"
  ) VALUES (
    new_organization_id,
    'PERSONAL',
    'ONBOARDING',
    'Configuracao em andamento',
    NULL,
    'setup-' || replace(new_organization_id::text, '-', ''),
    'America/Sao_Paulo',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  );

  INSERT INTO public."Unit" (
    "id", "organizationId", "name", "code", "timezone", "country",
    "createdAt", "updatedAt"
  ) VALUES (
    new_unit_id,
    new_organization_id,
    'Unidade principal',
    'MAIN',
    'America/Sao_Paulo',
    'BR',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  );

  INSERT INTO public."Role" (
    "id", "organizationId", "key", "name", "description", "isSystem",
    "createdAt", "updatedAt"
  ) VALUES (
    new_role_id,
    new_organization_id,
    'owner',
    'Proprietario',
    'Papel global criado pelo onboarding guiado.',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  );

  INSERT INTO public."RolePermission" (
    "id", "organizationId", "roleId", "permissionId", "createdAt", "updatedAt"
  )
  SELECT
    gen_random_uuid(),
    new_organization_id,
    new_role_id,
    permission.id,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  FROM public."Permission" AS permission
  WHERE permission.key IN (
    'organization:read',
    'organization:manage',
    'unit:read',
    'unit:manage',
    'student:read',
    'student:manage',
    'membership:manage',
    'subscription:read',
    'audit:read'
  );

  GET DIAGNOSTICS inserted_permission_count = ROW_COUNT;
  IF inserted_permission_count <> 9 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'onboarding_permission_catalog_missing';
  END IF;

  INSERT INTO public."Membership" (
    "id", "organizationId", "userId", "status", "createdAt", "updatedAt"
  ) VALUES (
    new_membership_id,
    new_organization_id,
    actor_id,
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  );

  INSERT INTO public."MembershipRole" (
    "id", "organizationId", "membershipId", "roleId", "unitId",
    "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid(),
    new_organization_id,
    new_membership_id,
    new_role_id,
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  );

  INSERT INTO public."OrganizationOnboarding" (
    "id", "organizationId", "createdByUserId", "status", "currentStep",
    "selectedPlanCode", "payload", "payloadVersion", "version", "createdAt", "updatedAt"
  ) VALUES (
    new_onboarding_id,
    new_organization_id,
    actor_id,
    'IN_PROGRESS',
    1,
    NULL,
    jsonb_build_object('schemaVersion', 1),
    1,
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  );

  INSERT INTO public."AuditLog" (
    "id", "organizationId", "unitId", "actorUserId", "action", "entity",
    "entityId", "metadata", "correlationId", "occurredAt", "createdAt"
  ) VALUES (
    gen_random_uuid(),
    new_organization_id,
    new_unit_id,
    actor_id,
    'onboarding.started',
    'OrganizationOnboarding',
    new_onboarding_id::text,
    jsonb_build_object('status', 'IN_PROGRESS', 'payloadVersion', 1),
    NULLIF(btrim(request_correlation_id), ''),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  );

  RETURN QUERY SELECT
    new_onboarding_id,
    new_organization_id,
    'IN_PROGRESS'::text,
    1,
    1;
END
$$;

ALTER FUNCTION public."start_actor_onboarding"(text, text, text)
  OWNER TO wefit_onboarding_owner;
REVOKE ALL ON FUNCTION public."start_actor_onboarding"(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public."start_actor_onboarding"(text, text, text)
  TO wefit_onboarding_consumer;

CREATE FUNCTION public."resolve_actor_onboarding"()
RETURNS TABLE (
  "onboardingId" uuid,
  "organizationId" uuid,
  "status" text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    onboarding.id AS "onboardingId",
    onboarding."organizationId",
    onboarding.status::text
  FROM public."OrganizationOnboarding" AS onboarding
  INNER JOIN public."User" AS app_user
    ON app_user.id = public."current_actor_user_id"()
    AND app_user."deletedAt" IS NULL
  INNER JOIN public."Membership" AS membership
    ON membership."organizationId" = onboarding."organizationId"
    AND membership."userId" = app_user.id
    AND membership.status = 'ACTIVE'
    AND membership."deletedAt" IS NULL
  INNER JOIN public."MembershipRole" AS membership_role
    ON membership_role."organizationId" = onboarding."organizationId"
    AND membership_role."membershipId" = membership.id
    AND membership_role."unitId" IS NULL
  INNER JOIN public."Role" AS role
    ON role."organizationId" = onboarding."organizationId"
    AND role.id = membership_role."roleId"
  INNER JOIN public."Organization" AS organization
    ON organization.id = onboarding."organizationId"
    AND organization."deletedAt" IS NULL
  WHERE onboarding."createdByUserId" = app_user.id
    AND onboarding."deletedAt" IS NULL
  ORDER BY onboarding."createdAt" DESC
  LIMIT 1
$$;

ALTER FUNCTION public."resolve_actor_onboarding"() OWNER TO wefit_onboarding_owner;
REVOKE ALL ON FUNCTION public."resolve_actor_onboarding"() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public."resolve_actor_onboarding"() TO wefit_onboarding_consumer;

ALTER TABLE public."OrganizationOnboarding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OrganizationOnboarding" FORCE ROW LEVEL SECURITY;

CREATE POLICY "OrganizationOnboarding_select" ON public."OrganizationOnboarding"
  FOR SELECT
  USING (
    "organizationId" = public."current_organization_id"()
    AND public."has_global_scope"("organizationId")
  );

CREATE POLICY "OrganizationOnboarding_insert" ON public."OrganizationOnboarding"
  FOR INSERT WITH CHECK (false);

CREATE POLICY "OrganizationOnboarding_update" ON public."OrganizationOnboarding"
  FOR UPDATE
  USING (
    "organizationId" = public."current_organization_id"()
    AND public."has_global_scope"("organizationId")
  )
  WITH CHECK (
    "organizationId" = public."current_organization_id"()
    AND public."has_global_scope"("organizationId")
  );

CREATE POLICY "OrganizationOnboarding_delete" ON public."OrganizationOnboarding"
  FOR DELETE USING (false);

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
    actor_context."organizationLifecycle",
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
      organization.lifecycle::text AS "organizationLifecycle",
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
