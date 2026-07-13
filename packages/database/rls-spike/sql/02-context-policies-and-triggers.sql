CREATE FUNCTION rls_spike.try_uuid(value text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF value IS NULL OR btrim(value) = '' THEN
    RETURN NULL;
  END IF;
  RETURN value::uuid;
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN NULL;
END
$function$;
ALTER FUNCTION rls_spike.try_uuid(text) OWNER TO wefit_migrator_spike_test;
-- statement-breakpoint
CREATE FUNCTION rls_spike.current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, rls_spike
AS $function$
  SELECT rls_spike.try_uuid(NULLIF(pg_catalog.current_setting('app.organization_id', true), ''))
$function$;
ALTER FUNCTION rls_spike.current_organization_id() OWNER TO wefit_migrator_spike_test;
-- statement-breakpoint
CREATE FUNCTION rls_spike.current_unit_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, rls_spike
AS $function$
  SELECT rls_spike.try_uuid(NULLIF(pg_catalog.current_setting('app.unit_id', true), ''))
$function$;
ALTER FUNCTION rls_spike.current_unit_id() OWNER TO wefit_migrator_spike_test;
-- statement-breakpoint
CREATE FUNCTION rls_spike.current_actor_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, rls_spike
AS $function$
  SELECT rls_spike.try_uuid(NULLIF(pg_catalog.current_setting('app.actor_user_id', true), ''))
$function$;
ALTER FUNCTION rls_spike.current_actor_user_id() OWNER TO wefit_migrator_spike_test;
-- statement-breakpoint
ALTER TABLE rls_spike.organization ENABLE ROW LEVEL SECURITY;
ALTER TABLE rls_spike.organization FORCE ROW LEVEL SECURITY;
ALTER TABLE rls_spike.unit ENABLE ROW LEVEL SECURITY;
ALTER TABLE rls_spike.unit FORCE ROW LEVEL SECURITY;
ALTER TABLE rls_spike.app_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE rls_spike.app_user FORCE ROW LEVEL SECURITY;
ALTER TABLE rls_spike.membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE rls_spike.membership FORCE ROW LEVEL SECURITY;
ALTER TABLE rls_spike.role ENABLE ROW LEVEL SECURITY;
ALTER TABLE rls_spike.role FORCE ROW LEVEL SECURITY;
ALTER TABLE rls_spike.permission ENABLE ROW LEVEL SECURITY;
ALTER TABLE rls_spike.permission FORCE ROW LEVEL SECURITY;
ALTER TABLE rls_spike.membership_role ENABLE ROW LEVEL SECURITY;
ALTER TABLE rls_spike.membership_role FORCE ROW LEVEL SECURITY;
ALTER TABLE rls_spike.role_permission ENABLE ROW LEVEL SECURITY;
ALTER TABLE rls_spike.role_permission FORCE ROW LEVEL SECURITY;
ALTER TABLE rls_spike.student ENABLE ROW LEVEL SECURITY;
ALTER TABLE rls_spike.student FORCE ROW LEVEL SECURITY;
ALTER TABLE rls_spike.student_unit ENABLE ROW LEVEL SECURITY;
ALTER TABLE rls_spike.student_unit FORCE ROW LEVEL SECURITY;
ALTER TABLE rls_spike.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE rls_spike.audit_log FORCE ROW LEVEL SECURITY;
ALTER TABLE rls_spike.constraint_probe ENABLE ROW LEVEL SECURITY;
ALTER TABLE rls_spike.constraint_probe FORCE ROW LEVEL SECURITY;
-- statement-breakpoint
CREATE POLICY membership_definer_select ON rls_spike.membership
  FOR SELECT TO wefit_rls_owner_spike_test
  USING (organization_id = rls_spike.current_organization_id());
CREATE POLICY membership_role_definer_select ON rls_spike.membership_role
  FOR SELECT TO wefit_rls_owner_spike_test
  USING (organization_id = rls_spike.current_organization_id());
GRANT SELECT ON rls_spike.membership, rls_spike.membership_role TO wefit_rls_owner_spike_test;
GRANT EXECUTE ON FUNCTION
  rls_spike.try_uuid(text),
  rls_spike.current_organization_id(),
  rls_spike.current_unit_id(),
  rls_spike.current_actor_user_id()
TO wefit_rls_owner_spike_test;
-- statement-breakpoint
CREATE FUNCTION rls_spike.has_global_scope(target_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, rls_spike
AS $function$
  SELECT target_organization_id IS NOT NULL
    AND target_organization_id = rls_spike.current_organization_id()
    AND EXISTS (
      SELECT 1
      FROM rls_spike.membership AS membership
      INNER JOIN rls_spike.membership_role AS assignment
        ON assignment.organization_id = membership.organization_id
       AND assignment.membership_id = membership.id
      WHERE membership.organization_id = target_organization_id
        AND membership.user_id = rls_spike.current_actor_user_id()
        AND membership.status = 'ACTIVE'
        AND membership.deleted_at IS NULL
        AND assignment.unit_id IS NULL
    )
$function$;
ALTER FUNCTION rls_spike.has_global_scope(uuid) OWNER TO wefit_rls_owner_spike_test;
REVOKE ALL ON FUNCTION rls_spike.has_global_scope(uuid) FROM PUBLIC;
-- statement-breakpoint
CREATE FUNCTION rls_spike.can_access_unit(target_organization_id uuid, target_unit_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, rls_spike
AS $function$
  SELECT target_organization_id IS NOT NULL
    AND target_unit_id IS NOT NULL
    AND target_organization_id = rls_spike.current_organization_id()
    AND EXISTS (
      SELECT 1
      FROM rls_spike.membership AS membership
      INNER JOIN rls_spike.membership_role AS assignment
        ON assignment.organization_id = membership.organization_id
       AND assignment.membership_id = membership.id
      WHERE membership.organization_id = target_organization_id
        AND membership.user_id = rls_spike.current_actor_user_id()
        AND membership.status = 'ACTIVE'
        AND membership.deleted_at IS NULL
        AND (assignment.unit_id IS NULL OR assignment.unit_id = target_unit_id)
    )
$function$;
ALTER FUNCTION rls_spike.can_access_unit(uuid, uuid) OWNER TO wefit_rls_owner_spike_test;
REVOKE ALL ON FUNCTION rls_spike.can_access_unit(uuid, uuid) FROM PUBLIC;
-- statement-breakpoint
CREATE FUNCTION rls_spike.tenant_access(target_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, rls_spike
AS $function$
  SELECT target_organization_id = rls_spike.current_organization_id()
    AND CASE
      WHEN rls_spike.current_unit_id() IS NULL
        THEN rls_spike.has_global_scope(target_organization_id)
      ELSE rls_spike.can_access_unit(target_organization_id, rls_spike.current_unit_id())
    END
$function$;
ALTER FUNCTION rls_spike.tenant_access(uuid) OWNER TO wefit_migrator_spike_test;
-- statement-breakpoint
CREATE FUNCTION rls_spike.unit_access(target_organization_id uuid, target_unit_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, rls_spike
AS $function$
  SELECT rls_spike.tenant_access(target_organization_id)
    AND (
      rls_spike.current_unit_id() IS NULL
      OR target_unit_id = rls_spike.current_unit_id()
    )
$function$;
ALTER FUNCTION rls_spike.unit_access(uuid, uuid) OWNER TO wefit_migrator_spike_test;
-- statement-breakpoint
CREATE FUNCTION rls_spike.membership_access(
  target_organization_id uuid,
  target_user_id uuid,
  target_status text,
  target_deleted_at timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, rls_spike
AS $function$
  SELECT target_organization_id = rls_spike.current_organization_id()
    AND target_user_id = rls_spike.current_actor_user_id()
    AND target_status = 'ACTIVE'
    AND target_deleted_at IS NULL
$function$;
ALTER FUNCTION rls_spike.membership_access(uuid, uuid, text, timestamptz)
  OWNER TO wefit_migrator_spike_test;
-- statement-breakpoint
CREATE FUNCTION rls_spike.membership_role_read_access(
  target_organization_id uuid,
  target_membership_id uuid,
  target_unit_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, rls_spike
AS $function$
  SELECT target_organization_id = rls_spike.current_organization_id()
    AND EXISTS (
      SELECT 1
      FROM rls_spike.membership AS membership
      WHERE membership.id = target_membership_id
        AND membership.organization_id = target_organization_id
        AND membership.user_id = rls_spike.current_actor_user_id()
        AND membership.status = 'ACTIVE'
        AND membership.deleted_at IS NULL
    )
    AND CASE
      WHEN rls_spike.current_unit_id() IS NULL
        THEN target_unit_id IS NULL AND rls_spike.has_global_scope(target_organization_id)
      ELSE (target_unit_id IS NULL OR target_unit_id = rls_spike.current_unit_id())
        AND rls_spike.can_access_unit(target_organization_id, rls_spike.current_unit_id())
    END
$function$;
ALTER FUNCTION rls_spike.membership_role_read_access(uuid, uuid, uuid)
  OWNER TO wefit_migrator_spike_test;
-- statement-breakpoint
CREATE FUNCTION rls_spike.membership_role_write_access(
  target_organization_id uuid,
  target_membership_id uuid,
  target_unit_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, rls_spike
AS $function$
  SELECT target_organization_id = rls_spike.current_organization_id()
    AND EXISTS (
      SELECT 1
      FROM rls_spike.membership AS membership
      WHERE membership.id = target_membership_id
        AND membership.organization_id = target_organization_id
        AND membership.user_id = rls_spike.current_actor_user_id()
        AND membership.status = 'ACTIVE'
        AND membership.deleted_at IS NULL
    )
    AND CASE
      WHEN rls_spike.current_unit_id() IS NULL
        THEN target_unit_id IS NULL AND rls_spike.has_global_scope(target_organization_id)
      ELSE target_unit_id = rls_spike.current_unit_id()
        AND rls_spike.can_access_unit(target_organization_id, rls_spike.current_unit_id())
    END
$function$;
ALTER FUNCTION rls_spike.membership_role_write_access(uuid, uuid, uuid)
  OWNER TO wefit_migrator_spike_test;
-- statement-breakpoint
CREATE FUNCTION rls_spike.role_access(target_organization_id uuid, target_role_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, rls_spike
AS $function$
  SELECT target_organization_id = rls_spike.current_organization_id()
    AND EXISTS (
      SELECT 1
      FROM rls_spike.membership_role AS assignment
      WHERE assignment.organization_id = target_organization_id
        AND assignment.role_id = target_role_id
    )
$function$;
ALTER FUNCTION rls_spike.role_access(uuid, uuid) OWNER TO wefit_migrator_spike_test;
-- statement-breakpoint
CREATE FUNCTION rls_spike.student_access(target_organization_id uuid, target_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, rls_spike
AS $function$
  SELECT target_organization_id = rls_spike.current_organization_id()
    AND CASE
      WHEN rls_spike.current_unit_id() IS NULL
        THEN rls_spike.has_global_scope(target_organization_id)
      ELSE rls_spike.can_access_unit(target_organization_id, rls_spike.current_unit_id())
        AND EXISTS (
          SELECT 1
          FROM rls_spike.student_unit AS link
          WHERE link.organization_id = target_organization_id
            AND link.student_id = target_student_id
            AND link.unit_id = rls_spike.current_unit_id()
            AND link.deleted_at IS NULL
        )
    END
$function$;
ALTER FUNCTION rls_spike.student_access(uuid, uuid) OWNER TO wefit_migrator_spike_test;
-- statement-breakpoint
REVOKE ALL ON FUNCTION
  rls_spike.try_uuid(text),
  rls_spike.current_organization_id(),
  rls_spike.current_unit_id(),
  rls_spike.current_actor_user_id(),
  rls_spike.tenant_access(uuid),
  rls_spike.unit_access(uuid, uuid),
  rls_spike.membership_access(uuid, uuid, text, timestamptz),
  rls_spike.membership_role_read_access(uuid, uuid, uuid),
  rls_spike.membership_role_write_access(uuid, uuid, uuid),
  rls_spike.role_access(uuid, uuid),
  rls_spike.student_access(uuid, uuid)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  rls_spike.try_uuid(text),
  rls_spike.current_organization_id(),
  rls_spike.current_unit_id(),
  rls_spike.current_actor_user_id(),
  rls_spike.has_global_scope(uuid),
  rls_spike.can_access_unit(uuid, uuid),
  rls_spike.tenant_access(uuid),
  rls_spike.unit_access(uuid, uuid),
  rls_spike.membership_access(uuid, uuid, text, timestamptz),
  rls_spike.membership_role_read_access(uuid, uuid, uuid),
  rls_spike.membership_role_write_access(uuid, uuid, uuid),
  rls_spike.role_access(uuid, uuid),
  rls_spike.student_access(uuid, uuid)
TO
  wefit_api_spike_test,
  wefit_worker_spike_test,
  wefit_ops_read_spike_test,
  wefit_ops_write_spike_test,
  wefit_migrator_spike_test;
-- statement-breakpoint
CREATE POLICY organization_select ON rls_spike.organization FOR SELECT
  USING (rls_spike.tenant_access(id));
CREATE POLICY organization_insert ON rls_spike.organization FOR INSERT
  WITH CHECK (rls_spike.tenant_access(id));
CREATE POLICY organization_update ON rls_spike.organization FOR UPDATE
  USING (rls_spike.tenant_access(id)) WITH CHECK (rls_spike.tenant_access(id));
CREATE POLICY organization_delete ON rls_spike.organization FOR DELETE
  USING (rls_spike.tenant_access(id));
-- statement-breakpoint
CREATE POLICY unit_select ON rls_spike.unit FOR SELECT
  USING (rls_spike.unit_access(organization_id, id));
CREATE POLICY unit_insert ON rls_spike.unit FOR INSERT
  WITH CHECK (rls_spike.unit_access(organization_id, id));
CREATE POLICY unit_update ON rls_spike.unit FOR UPDATE
  USING (rls_spike.unit_access(organization_id, id))
  WITH CHECK (rls_spike.unit_access(organization_id, id));
CREATE POLICY unit_delete ON rls_spike.unit FOR DELETE
  USING (rls_spike.unit_access(organization_id, id));
-- statement-breakpoint
CREATE POLICY app_user_select ON rls_spike.app_user FOR SELECT
  USING (id = rls_spike.current_actor_user_id());
CREATE POLICY app_user_insert ON rls_spike.app_user FOR INSERT
  WITH CHECK (id = rls_spike.current_actor_user_id());
CREATE POLICY app_user_update ON rls_spike.app_user FOR UPDATE
  USING (id = rls_spike.current_actor_user_id())
  WITH CHECK (id = rls_spike.current_actor_user_id());
CREATE POLICY app_user_delete ON rls_spike.app_user FOR DELETE
  USING (id = rls_spike.current_actor_user_id());
-- statement-breakpoint
CREATE POLICY membership_select ON rls_spike.membership FOR SELECT
  USING (rls_spike.membership_access(organization_id, user_id, status, deleted_at));
CREATE POLICY membership_insert ON rls_spike.membership FOR INSERT
  WITH CHECK (rls_spike.membership_access(organization_id, user_id, status, deleted_at));
CREATE POLICY membership_update ON rls_spike.membership FOR UPDATE
  USING (rls_spike.membership_access(organization_id, user_id, status, deleted_at))
  WITH CHECK (rls_spike.membership_access(organization_id, user_id, status, deleted_at));
CREATE POLICY membership_delete ON rls_spike.membership FOR DELETE
  USING (rls_spike.membership_access(organization_id, user_id, status, deleted_at));
-- statement-breakpoint
CREATE POLICY membership_role_select ON rls_spike.membership_role FOR SELECT
  USING (rls_spike.membership_role_read_access(organization_id, membership_id, unit_id));
CREATE POLICY membership_role_insert ON rls_spike.membership_role FOR INSERT
  WITH CHECK (rls_spike.membership_role_write_access(organization_id, membership_id, unit_id));
CREATE POLICY membership_role_update ON rls_spike.membership_role FOR UPDATE
  USING (rls_spike.membership_role_write_access(organization_id, membership_id, unit_id))
  WITH CHECK (rls_spike.membership_role_write_access(organization_id, membership_id, unit_id));
CREATE POLICY membership_role_delete ON rls_spike.membership_role FOR DELETE
  USING (rls_spike.membership_role_write_access(organization_id, membership_id, unit_id));
-- statement-breakpoint
CREATE POLICY role_select ON rls_spike.role FOR SELECT
  USING (rls_spike.role_access(organization_id, id));
CREATE POLICY role_insert ON rls_spike.role FOR INSERT
  WITH CHECK (rls_spike.tenant_access(organization_id));
CREATE POLICY role_update ON rls_spike.role FOR UPDATE
  USING (rls_spike.role_access(organization_id, id))
  WITH CHECK (rls_spike.tenant_access(organization_id));
CREATE POLICY role_delete ON rls_spike.role FOR DELETE
  USING (rls_spike.role_access(organization_id, id));
-- statement-breakpoint
CREATE POLICY permission_select ON rls_spike.permission FOR SELECT USING (true);
-- statement-breakpoint
CREATE POLICY role_permission_select ON rls_spike.role_permission FOR SELECT
  USING (rls_spike.role_access(organization_id, role_id));
CREATE POLICY role_permission_insert ON rls_spike.role_permission FOR INSERT
  WITH CHECK (rls_spike.role_access(organization_id, role_id));
CREATE POLICY role_permission_update ON rls_spike.role_permission FOR UPDATE
  USING (rls_spike.role_access(organization_id, role_id))
  WITH CHECK (rls_spike.role_access(organization_id, role_id));
CREATE POLICY role_permission_delete ON rls_spike.role_permission FOR DELETE
  USING (rls_spike.role_access(organization_id, role_id));
-- statement-breakpoint
CREATE POLICY student_select ON rls_spike.student FOR SELECT
  USING (rls_spike.student_access(organization_id, id));
CREATE POLICY student_insert ON rls_spike.student FOR INSERT
  WITH CHECK (rls_spike.tenant_access(organization_id));
CREATE POLICY student_update ON rls_spike.student FOR UPDATE
  USING (rls_spike.student_access(organization_id, id))
  WITH CHECK (rls_spike.tenant_access(organization_id));
CREATE POLICY student_delete ON rls_spike.student FOR DELETE
  USING (rls_spike.student_access(organization_id, id));
-- statement-breakpoint
CREATE POLICY student_unit_select ON rls_spike.student_unit FOR SELECT
  USING (rls_spike.unit_access(organization_id, unit_id));
CREATE POLICY student_unit_insert ON rls_spike.student_unit FOR INSERT
  WITH CHECK (rls_spike.unit_access(organization_id, unit_id));
CREATE POLICY student_unit_update ON rls_spike.student_unit FOR UPDATE
  USING (rls_spike.unit_access(organization_id, unit_id))
  WITH CHECK (rls_spike.unit_access(organization_id, unit_id));
CREATE POLICY student_unit_delete ON rls_spike.student_unit FOR DELETE
  USING (rls_spike.unit_access(organization_id, unit_id));
-- statement-breakpoint
CREATE POLICY audit_log_select ON rls_spike.audit_log FOR SELECT
  USING (
    rls_spike.tenant_access(organization_id)
    AND (rls_spike.current_unit_id() IS NULL OR unit_id = rls_spike.current_unit_id())
  );
CREATE POLICY audit_log_insert ON rls_spike.audit_log FOR INSERT
  WITH CHECK (
    rls_spike.tenant_access(organization_id)
    AND (
      (rls_spike.current_unit_id() IS NULL)
      OR unit_id = rls_spike.current_unit_id()
    )
  );
CREATE POLICY audit_log_update ON rls_spike.audit_log FOR UPDATE
  USING (false) WITH CHECK (false);
CREATE POLICY audit_log_delete ON rls_spike.audit_log FOR DELETE USING (false);
-- statement-breakpoint
CREATE POLICY constraint_probe_select ON rls_spike.constraint_probe FOR SELECT
  USING (rls_spike.tenant_access(organization_id));
CREATE POLICY constraint_probe_insert ON rls_spike.constraint_probe FOR INSERT
  WITH CHECK (rls_spike.tenant_access(organization_id));
CREATE POLICY constraint_probe_update ON rls_spike.constraint_probe FOR UPDATE
  USING (rls_spike.tenant_access(organization_id))
  WITH CHECK (rls_spike.tenant_access(organization_id));
CREATE POLICY constraint_probe_delete ON rls_spike.constraint_probe FOR DELETE
  USING (rls_spike.tenant_access(organization_id));
-- statement-breakpoint
CREATE FUNCTION rls_spike.enforce_student_unit_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, rls_spike
AS $function$
DECLARE
  required_unit_id uuid := rls_spike.current_unit_id();
BEGIN
  IF required_unit_id IS NULL OR NEW.status <> 'ACTIVE' OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.organization_id <> rls_spike.current_organization_id() THEN
    RAISE EXCEPTION 'student organization does not match transaction context'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM rls_spike.student_unit AS link
    WHERE link.organization_id = NEW.organization_id
      AND link.student_id = NEW.id
      AND link.unit_id = required_unit_id
      AND link.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'active student requires an active link to the transaction unit'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$function$;
ALTER FUNCTION rls_spike.enforce_student_unit_context() OWNER TO wefit_migrator_spike_test;
REVOKE ALL ON FUNCTION rls_spike.enforce_student_unit_context() FROM PUBLIC;
-- statement-breakpoint
CREATE CONSTRAINT TRIGGER student_unit_context_invariant
AFTER INSERT OR UPDATE ON rls_spike.student
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION rls_spike.enforce_student_unit_context();
-- statement-breakpoint
CREATE FUNCTION rls_spike.touch_student_for_link_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, rls_spike
AS $function$
BEGIN
  UPDATE rls_spike.student
  SET updated_at = clock_timestamp()
  WHERE organization_id = OLD.organization_id
    AND id = OLD.student_id;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END
$function$;
ALTER FUNCTION rls_spike.touch_student_for_link_change() OWNER TO wefit_migrator_spike_test;
REVOKE ALL ON FUNCTION rls_spike.touch_student_for_link_change() FROM PUBLIC;
-- statement-breakpoint
CREATE TRIGGER student_unit_touch_before_delete
BEFORE DELETE ON rls_spike.student_unit
FOR EACH ROW EXECUTE FUNCTION rls_spike.touch_student_for_link_change();
CREATE TRIGGER student_unit_touch_before_update
BEFORE UPDATE ON rls_spike.student_unit
FOR EACH ROW EXECUTE FUNCTION rls_spike.touch_student_for_link_change();
-- statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON
  rls_spike.organization,
  rls_spike.unit,
  rls_spike.app_user,
  rls_spike.membership,
  rls_spike.role,
  rls_spike.membership_role,
  rls_spike.role_permission,
  rls_spike.student,
  rls_spike.student_unit,
  rls_spike.audit_log,
  rls_spike.constraint_probe
TO wefit_api_spike_test;
GRANT SELECT ON rls_spike.permission TO wefit_api_spike_test;
-- statement-breakpoint
GRANT SELECT ON
  rls_spike.organization,
  rls_spike.unit,
  rls_spike.app_user,
  rls_spike.membership,
  rls_spike.role,
  rls_spike.permission,
  rls_spike.membership_role,
  rls_spike.role_permission,
  rls_spike.student,
  rls_spike.student_unit,
  rls_spike.audit_log
TO wefit_worker_spike_test;
GRANT INSERT ON rls_spike.audit_log TO wefit_worker_spike_test;
-- statement-breakpoint
GRANT SELECT ON ALL TABLES IN SCHEMA rls_spike TO wefit_ops_read_spike_test;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  rls_spike.organization,
  rls_spike.unit,
  rls_spike.student,
  rls_spike.student_unit,
  rls_spike.audit_log,
  rls_spike.constraint_probe
TO wefit_ops_write_spike_test;
GRANT SELECT ON
  rls_spike.app_user,
  rls_spike.membership,
  rls_spike.role,
  rls_spike.permission,
  rls_spike.membership_role,
  rls_spike.role_permission
TO wefit_ops_write_spike_test;
