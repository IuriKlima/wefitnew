


-- Drop existing functions if we need to replace them
DROP FUNCTION IF EXISTS public."try_uuid"(text);
DROP FUNCTION IF EXISTS public."current_organization_id"();
DROP FUNCTION IF EXISTS public."current_unit_id"();
DROP FUNCTION IF EXISTS public."current_actor_user_id"();
DROP FUNCTION IF EXISTS public."has_global_scope"(uuid);
DROP FUNCTION IF EXISTS public."can_access_unit"(uuid, uuid);

-- 1. Helper Functions
CREATE FUNCTION public."try_uuid"(value text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  IF value IS NULL OR btrim(value) = '' THEN
    RETURN NULL;
  END IF;
  RETURN value::uuid;
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN NULL;
END
$$;

CREATE FUNCTION public."current_organization_id"()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT public."try_uuid"(NULLIF(pg_catalog.current_setting('app.organization_id', true), ''))
$$;

CREATE FUNCTION public."current_unit_id"()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT public."try_uuid"(NULLIF(pg_catalog.current_setting('app.unit_id', true), ''))
$$;

CREATE FUNCTION public."current_actor_user_id"()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT public."try_uuid"(NULLIF(pg_catalog.current_setting('app.actor_user_id', true), ''))
$$;

-- Create RLS Owner Role if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wefit_rls_owner') THEN
    CREATE ROLE wefit_rls_owner NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO wefit_rls_owner;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO wefit_rls_owner;

-- 2. SECURITY DEFINER Functions
CREATE FUNCTION public."has_global_scope"(target_organization_id uuid)
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
      FROM public."Membership" m
      INNER JOIN public."MembershipRole" mr ON mr."membershipId" = m.id
      WHERE m."organizationId" = target_organization_id
        AND m."userId" = public."current_actor_user_id"()
        AND m.status = 'ACTIVE'
        AND mr."unitId" IS NULL
    );
$$;

ALTER FUNCTION public."has_global_scope"(uuid) OWNER TO wefit_rls_owner;
REVOKE EXECUTE ON FUNCTION public."has_global_scope"(uuid) FROM PUBLIC;

CREATE FUNCTION public."can_access_unit"(target_organization_id uuid, target_unit_id uuid)
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
      FROM public."Membership" m
      INNER JOIN public."MembershipRole" mr ON mr."membershipId" = m.id
      WHERE m."organizationId" = target_organization_id
        AND m."userId" = public."current_actor_user_id"()
        AND m.status = 'ACTIVE'
        AND (mr."unitId" IS NULL OR mr."unitId" = target_unit_id)
    );
$$;

ALTER FUNCTION public."can_access_unit"(uuid, uuid) OWNER TO wefit_rls_owner;
REVOKE EXECUTE ON FUNCTION public."can_access_unit"(uuid, uuid) FROM PUBLIC;

-- 3. Enable RLS
ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Organization" FORCE ROW LEVEL SECURITY;

ALTER TABLE "Unit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Unit" FORCE ROW LEVEL SECURITY;

ALTER TABLE "Membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Membership" FORCE ROW LEVEL SECURITY;

ALTER TABLE "Role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Role" FORCE ROW LEVEL SECURITY;

ALTER TABLE "MembershipRole" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MembershipRole" FORCE ROW LEVEL SECURITY;

ALTER TABLE "RolePermission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RolePermission" FORCE ROW LEVEL SECURITY;

ALTER TABLE "OrganizationSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrganizationSubscription" FORCE ROW LEVEL SECURITY;

ALTER TABLE "Student" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Student" FORCE ROW LEVEL SECURITY;

ALTER TABLE "StudentUnit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentUnit" FORCE ROW LEVEL SECURITY;

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;

-- 4. Policies

-- Organization
CREATE POLICY "Organization_select" ON "Organization"
  FOR SELECT
  USING (
    id = public."current_organization_id"()
    AND (public."has_global_scope"(id) OR public."can_access_unit"(id, public."current_unit_id"()))
  );

CREATE POLICY "Organization_insert" ON "Organization"
  FOR INSERT
  WITH CHECK (id = public."current_organization_id"() AND public."has_global_scope"(id));

CREATE POLICY "Organization_update" ON "Organization"
  FOR UPDATE
  USING (id = public."current_organization_id"() AND public."has_global_scope"(id))
  WITH CHECK (id = public."current_organization_id"() AND public."has_global_scope"(id));

CREATE POLICY "Organization_delete" ON "Organization"
  FOR DELETE
  USING (id = public."current_organization_id"() AND public."has_global_scope"(id));


-- Unit
CREATE POLICY "Unit_select" ON "Unit"
  FOR SELECT
  USING (
    "organizationId" = public."current_organization_id"()
    AND (public."current_unit_id"() IS NULL OR id = public."current_unit_id"())
  );

CREATE POLICY "Unit_insert" ON "Unit"
  FOR INSERT
  WITH CHECK ("organizationId" = public."current_organization_id"() AND public."has_global_scope"("organizationId"));

CREATE POLICY "Unit_update" ON "Unit"
  FOR UPDATE
  USING ("organizationId" = public."current_organization_id"() AND public."has_global_scope"("organizationId"))
  WITH CHECK ("organizationId" = public."current_organization_id"() AND public."has_global_scope"("organizationId"));

CREATE POLICY "Unit_delete" ON "Unit"
  FOR DELETE
  USING ("organizationId" = public."current_organization_id"() AND public."has_global_scope"("organizationId"));


-- Membership
CREATE POLICY "Membership_select" ON "Membership"
  FOR SELECT
  USING (
    "organizationId" = public."current_organization_id"()
    AND "userId" = public."current_actor_user_id"()
    AND status = 'ACTIVE'
  );

CREATE POLICY "Membership_insert" ON "Membership"
  FOR INSERT
  WITH CHECK ("organizationId" = public."current_organization_id"() AND public."has_global_scope"("organizationId"));

CREATE POLICY "Membership_update" ON "Membership"
  FOR UPDATE
  USING ("organizationId" = public."current_organization_id"() AND public."has_global_scope"("organizationId"))
  WITH CHECK ("organizationId" = public."current_organization_id"() AND public."has_global_scope"("organizationId"));

CREATE POLICY "Membership_delete" ON "Membership"
  FOR DELETE
  USING ("organizationId" = public."current_organization_id"() AND public."has_global_scope"("organizationId"));


-- MembershipRole
CREATE POLICY "MembershipRole_select" ON "MembershipRole"
  FOR SELECT
  USING (
    "organizationId" = public."current_organization_id"()
    AND ("unitId" IS NULL OR "unitId" = public."current_unit_id"() OR public."current_unit_id"() IS NULL)
  );

CREATE POLICY "MembershipRole_insert" ON "MembershipRole"
  FOR INSERT
  WITH CHECK ("organizationId" = public."current_organization_id"() AND public."has_global_scope"("organizationId"));

CREATE POLICY "MembershipRole_update" ON "MembershipRole"
  FOR UPDATE
  USING ("organizationId" = public."current_organization_id"() AND public."has_global_scope"("organizationId"))
  WITH CHECK ("organizationId" = public."current_organization_id"() AND public."has_global_scope"("organizationId"));

CREATE POLICY "MembershipRole_delete" ON "MembershipRole"
  FOR DELETE
  USING ("organizationId" = public."current_organization_id"() AND public."has_global_scope"("organizationId"));


-- Role
CREATE POLICY "Role_select" ON "Role"
  FOR SELECT
  USING ("organizationId" = public."current_organization_id"());

CREATE POLICY "Role_insert" ON "Role"
  FOR INSERT
  WITH CHECK ("organizationId" = public."current_organization_id"() AND public."has_global_scope"("organizationId"));

CREATE POLICY "Role_update" ON "Role"
  FOR UPDATE
  USING ("organizationId" = public."current_organization_id"() AND public."has_global_scope"("organizationId"))
  WITH CHECK ("organizationId" = public."current_organization_id"() AND public."has_global_scope"("organizationId"));

CREATE POLICY "Role_delete" ON "Role"
  FOR DELETE
  USING ("organizationId" = public."current_organization_id"() AND public."has_global_scope"("organizationId"));


-- RolePermission
CREATE POLICY "RolePermission_select" ON "RolePermission"
  FOR SELECT
  USING ("organizationId" = public."current_organization_id"());

CREATE POLICY "RolePermission_insert" ON "RolePermission"
  FOR INSERT
  WITH CHECK ("organizationId" = public."current_organization_id"() AND public."has_global_scope"("organizationId"));

CREATE POLICY "RolePermission_update" ON "RolePermission"
  FOR UPDATE
  USING ("organizationId" = public."current_organization_id"() AND public."has_global_scope"("organizationId"))
  WITH CHECK ("organizationId" = public."current_organization_id"() AND public."has_global_scope"("organizationId"));

CREATE POLICY "RolePermission_delete" ON "RolePermission"
  FOR DELETE
  USING ("organizationId" = public."current_organization_id"() AND public."has_global_scope"("organizationId"));


-- OrganizationSubscription
CREATE POLICY "OrganizationSubscription_select" ON "OrganizationSubscription"
  FOR SELECT
  USING ("organizationId" = public."current_organization_id"());

CREATE POLICY "OrganizationSubscription_insert" ON "OrganizationSubscription"
  FOR INSERT
  WITH CHECK ("organizationId" = public."current_organization_id"() AND public."has_global_scope"("organizationId"));

CREATE POLICY "OrganizationSubscription_update" ON "OrganizationSubscription"
  FOR UPDATE
  USING ("organizationId" = public."current_organization_id"() AND public."has_global_scope"("organizationId"))
  WITH CHECK ("organizationId" = public."current_organization_id"() AND public."has_global_scope"("organizationId"));

CREATE POLICY "OrganizationSubscription_delete" ON "OrganizationSubscription"
  FOR DELETE
  USING ("organizationId" = public."current_organization_id"() AND public."has_global_scope"("organizationId"));


-- Student
CREATE POLICY "Student_select" ON "Student"
  FOR SELECT
  USING (
    "organizationId" = public."current_organization_id"()
    AND (
      public."current_unit_id"() IS NULL
      OR EXISTS (
        SELECT 1
        FROM public."StudentUnit" su
        WHERE su."organizationId" = "organizationId"
          AND su."studentId" = id
          AND su."unitId" = public."current_unit_id"()
          AND su."deletedAt" IS NULL
      )
    )
  );

CREATE POLICY "Student_insert" ON "Student"
  FOR INSERT
  WITH CHECK ("organizationId" = public."current_organization_id"());

CREATE POLICY "Student_update" ON "Student"
  FOR UPDATE
  USING ("organizationId" = public."current_organization_id"())
  WITH CHECK ("organizationId" = public."current_organization_id"());

CREATE POLICY "Student_delete" ON "Student"
  FOR DELETE
  USING ("organizationId" = public."current_organization_id"());


-- StudentUnit
CREATE POLICY "StudentUnit_select" ON "StudentUnit"
  FOR SELECT
  USING (
    "organizationId" = public."current_organization_id"()
    AND (public."current_unit_id"() IS NULL OR "unitId" = public."current_unit_id"())
  );

CREATE POLICY "StudentUnit_insert" ON "StudentUnit"
  FOR INSERT
  WITH CHECK (
    "organizationId" = public."current_organization_id"()
    AND (public."current_unit_id"() IS NULL OR "unitId" = public."current_unit_id"())
  );

CREATE POLICY "StudentUnit_update" ON "StudentUnit"
  FOR UPDATE
  USING (
    "organizationId" = public."current_organization_id"()
    AND (public."current_unit_id"() IS NULL OR "unitId" = public."current_unit_id"())
  )
  WITH CHECK (
    "organizationId" = public."current_organization_id"()
    AND (public."current_unit_id"() IS NULL OR "unitId" = public."current_unit_id"())
  );

CREATE POLICY "StudentUnit_delete" ON "StudentUnit"
  FOR DELETE
  USING (
    "organizationId" = public."current_organization_id"()
    AND (public."current_unit_id"() IS NULL OR "unitId" = public."current_unit_id"())
  );


-- AuditLog
CREATE POLICY "AuditLog_select" ON "AuditLog"
  FOR SELECT
  USING (
    "organizationId" = public."current_organization_id"()
    AND (
      public."current_unit_id"() IS NULL
      OR "unitId" = public."current_unit_id"()
    )
  );

CREATE POLICY "AuditLog_insert" ON "AuditLog"
  FOR INSERT
  WITH CHECK (
    "organizationId" = public."current_organization_id"()
    AND (
      public."current_unit_id"() IS NULL
      OR "unitId" = public."current_unit_id"()
    )
  );

CREATE POLICY "AuditLog_update" ON "AuditLog"
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

CREATE POLICY "AuditLog_delete" ON "AuditLog"
  FOR DELETE
  USING (false);

