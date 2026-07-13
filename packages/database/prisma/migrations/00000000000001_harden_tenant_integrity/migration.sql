CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'SUSPENDED', 'CANCELED', 'EXPIRED');

ALTER TABLE "OrganizationSubscription"
  ALTER COLUMN "status" TYPE "SubscriptionStatus"
  USING (
    CASE UPPER("status")
      WHEN 'TRIALING' THEN 'TRIALING'::"SubscriptionStatus"
      WHEN 'TRIAL' THEN 'TRIALING'::"SubscriptionStatus"
      WHEN 'ACTIVE' THEN 'ACTIVE'::"SubscriptionStatus"
      WHEN 'SUSPENDED' THEN 'SUSPENDED'::"SubscriptionStatus"
      WHEN 'CANCELED' THEN 'CANCELED'::"SubscriptionStatus"
      WHEN 'CANCELLED' THEN 'CANCELED'::"SubscriptionStatus"
      WHEN 'EXPIRED' THEN 'EXPIRED'::"SubscriptionStatus"
      ELSE 'CANCELED'::"SubscriptionStatus"
    END
  );

ALTER TABLE "MembershipRole" ADD COLUMN "organizationId" UUID;

UPDATE "MembershipRole" AS mr
SET "organizationId" = m."organizationId"
FROM "Membership" AS m
WHERE mr."membershipId" = m."id";

ALTER TABLE "MembershipRole" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "AuditLog" ADD COLUMN "correlationId" TEXT;
ALTER TABLE "AuditLog" DROP COLUMN "updatedAt";

CREATE UNIQUE INDEX "Unit_organizationId_id_key" ON "Unit"("organizationId", "id");
CREATE UNIQUE INDEX "Membership_organizationId_id_key" ON "Membership"("organizationId", "id");
CREATE UNIQUE INDEX "Role_organizationId_id_key" ON "Role"("organizationId", "id");

ALTER TABLE "MembershipRole" DROP CONSTRAINT "MembershipRole_membershipId_fkey";
ALTER TABLE "MembershipRole" DROP CONSTRAINT "MembershipRole_roleId_fkey";
ALTER TABLE "MembershipRole" DROP CONSTRAINT "MembershipRole_unitId_fkey";

ALTER TABLE "MembershipRole"
  ADD CONSTRAINT "MembershipRole_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MembershipRole"
  ADD CONSTRAINT "MembershipRole_organizationId_membershipId_fkey"
  FOREIGN KEY ("organizationId", "membershipId") REFERENCES "Membership"("organizationId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MembershipRole"
  ADD CONSTRAINT "MembershipRole_organizationId_roleId_fkey"
  FOREIGN KEY ("organizationId", "roleId") REFERENCES "Role"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MembershipRole"
  ADD CONSTRAINT "MembershipRole_organizationId_unitId_fkey"
  FOREIGN KEY ("organizationId", "unitId") REFERENCES "Unit"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "MembershipRole_organizationId_idx" ON "MembershipRole"("organizationId");
CREATE INDEX "MembershipRole_organizationId_membershipId_idx" ON "MembershipRole"("organizationId", "membershipId");
CREATE INDEX "MembershipRole_organizationId_roleId_idx" ON "MembershipRole"("organizationId", "roleId");
CREATE INDEX "MembershipRole_organizationId_unitId_idx" ON "MembershipRole"("organizationId", "unitId");

CREATE UNIQUE INDEX "MembershipRole_unique_unit_scope"
  ON "MembershipRole"("organizationId", "membershipId", "roleId", "unitId")
  WHERE "unitId" IS NOT NULL;

CREATE UNIQUE INDEX "MembershipRole_unique_organization_scope"
  ON "MembershipRole"("organizationId", "membershipId", "roleId")
  WHERE "unitId" IS NULL;

ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_organizationId_unitId_fkey"
  FOREIGN KEY ("organizationId", "unitId") REFERENCES "Unit"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "AuditLog_organizationId_unitId_idx" ON "AuditLog"("organizationId", "unitId");

CREATE UNIQUE INDEX "OrganizationSubscription_single_open_effective_idx"
  ON "OrganizationSubscription"("organizationId")
  WHERE "status" IN ('TRIALING', 'ACTIVE') AND "endsAt" IS NULL;
