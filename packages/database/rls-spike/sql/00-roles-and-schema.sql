DO $block$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'wefit_migrator_spike_test') THEN
    CREATE ROLE wefit_migrator_spike_test NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'wefit_api_spike_test') THEN
    CREATE ROLE wefit_api_spike_test NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'wefit_worker_spike_test') THEN
    CREATE ROLE wefit_worker_spike_test NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'wefit_ops_read_spike_test') THEN
    CREATE ROLE wefit_ops_read_spike_test NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'wefit_ops_write_spike_test') THEN
    CREATE ROLE wefit_ops_write_spike_test NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'wefit_rls_owner_spike_test') THEN
    CREATE ROLE wefit_rls_owner_spike_test NOLOGIN;
  END IF;
END
$block$;
-- statement-breakpoint
ALTER ROLE wefit_migrator_spike_test NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOLOGIN;
ALTER ROLE wefit_api_spike_test NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOLOGIN;
ALTER ROLE wefit_worker_spike_test NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOLOGIN;
ALTER ROLE wefit_ops_read_spike_test NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOLOGIN;
ALTER ROLE wefit_ops_write_spike_test NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOLOGIN;
ALTER ROLE wefit_rls_owner_spike_test NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOLOGIN;
-- statement-breakpoint
DROP SCHEMA IF EXISTS rls_spike CASCADE;
-- statement-breakpoint
CREATE SCHEMA rls_spike AUTHORIZATION wefit_migrator_spike_test;
-- statement-breakpoint
REVOKE ALL ON SCHEMA rls_spike FROM PUBLIC;
GRANT USAGE ON SCHEMA rls_spike TO
  wefit_api_spike_test,
  wefit_worker_spike_test,
  wefit_ops_read_spike_test,
  wefit_ops_write_spike_test,
  wefit_rls_owner_spike_test;
