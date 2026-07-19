-- Restores the mandatory RLS posture if a legacy test or an operational error disabled it.
-- FORCE does not imply ENABLE in PostgreSQL, so both flags are asserted explicitly.

ALTER TABLE public."Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Organization" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."Unit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Unit" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."Membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Membership" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."Role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Role" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."MembershipRole" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MembershipRole" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."RolePermission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RolePermission" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."OrganizationSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OrganizationSubscription" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."Student" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Student" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."StudentUnit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."StudentUnit" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuditLog" FORCE ROW LEVEL SECURITY;
