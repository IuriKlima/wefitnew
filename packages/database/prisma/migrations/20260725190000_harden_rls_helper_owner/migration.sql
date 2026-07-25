-- Keeps RLS helper evaluation outside the policies it is responsible for evaluating.
-- This NOLOGIN role owns only the narrow SECURITY DEFINER helpers and is never inherited
-- by an application runtime role.

ALTER ROLE wefit_rls_owner
  NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS NOLOGIN;

REVOKE wefit_rls_owner FROM wefit_context_consumer;
REVOKE wefit_rls_owner FROM wefit_onboarding_consumer;

