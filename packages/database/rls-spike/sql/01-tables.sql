CREATE TABLE rls_spike.organization (
  id uuid PRIMARY KEY,
  name text NOT NULL
);
ALTER TABLE rls_spike.organization OWNER TO wefit_migrator_spike_test;
-- statement-breakpoint
CREATE TABLE rls_spike.unit (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  name text NOT NULL,
  code text NOT NULL,
  deleted_at timestamptz,
  CONSTRAINT unit_organization_fk FOREIGN KEY (organization_id)
    REFERENCES rls_spike.organization (id) ON DELETE RESTRICT,
  CONSTRAINT unit_organization_id_key UNIQUE (organization_id, id),
  CONSTRAINT unit_organization_code_key UNIQUE (organization_id, code)
);
ALTER TABLE rls_spike.unit OWNER TO wefit_migrator_spike_test;
-- statement-breakpoint
CREATE TABLE rls_spike.app_user (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  deleted_at timestamptz
);
ALTER TABLE rls_spike.app_user OWNER TO wefit_migrator_spike_test;
-- statement-breakpoint
CREATE TABLE rls_spike.membership (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'SUSPENDED')),
  deleted_at timestamptz,
  CONSTRAINT membership_organization_fk FOREIGN KEY (organization_id)
    REFERENCES rls_spike.organization (id) ON DELETE RESTRICT,
  CONSTRAINT membership_user_fk FOREIGN KEY (user_id)
    REFERENCES rls_spike.app_user (id) ON DELETE RESTRICT,
  CONSTRAINT membership_organization_id_key UNIQUE (organization_id, id),
  CONSTRAINT membership_organization_user_key UNIQUE (organization_id, user_id)
);
ALTER TABLE rls_spike.membership OWNER TO wefit_migrator_spike_test;
-- statement-breakpoint
CREATE TABLE rls_spike.role (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  key text NOT NULL,
  name text NOT NULL,
  CONSTRAINT role_organization_fk FOREIGN KEY (organization_id)
    REFERENCES rls_spike.organization (id) ON DELETE RESTRICT,
  CONSTRAINT role_organization_id_key UNIQUE (organization_id, id),
  CONSTRAINT role_organization_key_key UNIQUE (organization_id, key)
);
ALTER TABLE rls_spike.role OWNER TO wefit_migrator_spike_test;
-- statement-breakpoint
CREATE TABLE rls_spike.permission (
  id uuid PRIMARY KEY,
  key text NOT NULL UNIQUE
);
ALTER TABLE rls_spike.permission OWNER TO wefit_migrator_spike_test;
-- statement-breakpoint
CREATE TABLE rls_spike.membership_role (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  role_id uuid NOT NULL,
  unit_id uuid,
  CONSTRAINT membership_role_organization_fk FOREIGN KEY (organization_id)
    REFERENCES rls_spike.organization (id) ON DELETE RESTRICT,
  CONSTRAINT membership_role_membership_fk FOREIGN KEY (organization_id, membership_id)
    REFERENCES rls_spike.membership (organization_id, id) ON DELETE CASCADE,
  CONSTRAINT membership_role_role_fk FOREIGN KEY (organization_id, role_id)
    REFERENCES rls_spike.role (organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT membership_role_unit_fk FOREIGN KEY (organization_id, unit_id)
    REFERENCES rls_spike.unit (organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT membership_role_assignment_key UNIQUE (membership_id, role_id, unit_id)
);
ALTER TABLE rls_spike.membership_role OWNER TO wefit_migrator_spike_test;
-- statement-breakpoint
CREATE TABLE rls_spike.role_permission (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  role_id uuid NOT NULL,
  permission_id uuid NOT NULL,
  CONSTRAINT role_permission_role_fk FOREIGN KEY (organization_id, role_id)
    REFERENCES rls_spike.role (organization_id, id) ON DELETE CASCADE,
  CONSTRAINT role_permission_permission_fk FOREIGN KEY (permission_id)
    REFERENCES rls_spike.permission (id) ON DELETE RESTRICT,
  CONSTRAINT role_permission_assignment_key UNIQUE (role_id, permission_id)
);
ALTER TABLE rls_spike.role_permission OWNER TO wefit_migrator_spike_test;
-- statement-breakpoint
CREATE TABLE rls_spike.student (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  deleted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT student_organization_fk FOREIGN KEY (organization_id)
    REFERENCES rls_spike.organization (id) ON DELETE RESTRICT,
  CONSTRAINT student_organization_id_key UNIQUE (organization_id, id)
);
ALTER TABLE rls_spike.student OWNER TO wefit_migrator_spike_test;
-- statement-breakpoint
CREATE TABLE rls_spike.student_unit (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  student_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  deleted_at timestamptz,
  CONSTRAINT student_unit_organization_fk FOREIGN KEY (organization_id)
    REFERENCES rls_spike.organization (id) ON DELETE RESTRICT,
  CONSTRAINT student_unit_student_fk FOREIGN KEY (organization_id, student_id)
    REFERENCES rls_spike.student (organization_id, id) ON DELETE CASCADE,
  CONSTRAINT student_unit_unit_fk FOREIGN KEY (organization_id, unit_id)
    REFERENCES rls_spike.unit (organization_id, id) ON DELETE RESTRICT
);
ALTER TABLE rls_spike.student_unit OWNER TO wefit_migrator_spike_test;
-- statement-breakpoint
CREATE UNIQUE INDEX student_unit_active_key
  ON rls_spike.student_unit (organization_id, student_id, unit_id)
  WHERE deleted_at IS NULL;
CREATE INDEX student_unit_scope_idx
  ON rls_spike.student_unit (organization_id, unit_id, student_id)
  WHERE deleted_at IS NULL;
CREATE INDEX student_scope_idx
  ON rls_spike.student (organization_id, status, id)
  WHERE deleted_at IS NULL;
-- statement-breakpoint
CREATE TABLE rls_spike.audit_log (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  unit_id uuid,
  actor_user_id uuid,
  action text NOT NULL,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT audit_log_organization_fk FOREIGN KEY (organization_id)
    REFERENCES rls_spike.organization (id) ON DELETE RESTRICT,
  CONSTRAINT audit_log_unit_fk FOREIGN KEY (organization_id, unit_id)
    REFERENCES rls_spike.unit (organization_id, id) ON DELETE RESTRICT
);
ALTER TABLE rls_spike.audit_log OWNER TO wefit_migrator_spike_test;
-- statement-breakpoint
CREATE INDEX audit_log_scope_idx
  ON rls_spike.audit_log (organization_id, unit_id, created_at);
-- statement-breakpoint
CREATE TABLE rls_spike.constraint_probe (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  external_key text NOT NULL UNIQUE,
  CONSTRAINT constraint_probe_organization_fk FOREIGN KEY (organization_id)
    REFERENCES rls_spike.organization (id) ON DELETE RESTRICT
);
ALTER TABLE rls_spike.constraint_probe OWNER TO wefit_migrator_spike_test;
