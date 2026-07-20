-- Complements the onboarding migration after validating a restricted runtime role.
-- The consumer needs these helpers only because ordinary onboarding reads are protected by RLS.

ALTER ROLE wefit_onboarding_consumer
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOLOGIN;

GRANT USAGE ON SCHEMA public TO wefit_onboarding_consumer;
GRANT EXECUTE ON FUNCTION public."has_global_scope"(uuid)
  TO wefit_onboarding_consumer;
GRANT EXECUTE ON FUNCTION public."can_access_unit"(uuid, uuid)
  TO wefit_onboarding_consumer;

REVOKE wefit_onboarding_owner FROM wefit_onboarding_consumer;
REVOKE wefit_context_reader FROM wefit_onboarding_consumer;
