CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "Student" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "userId" UUID,
  "name" TEXT NOT NULL,
  "socialName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "birthDate" DATE,
  "operationalNote" VARCHAR(500),
  "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudentUnit" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "unitId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "StudentUnit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Student_organizationId_id_key" ON "Student"("organizationId", "id");
CREATE UNIQUE INDEX "Student_unique_active_user_per_organization"
  ON "Student"("organizationId", "userId")
  WHERE "userId" IS NOT NULL AND "deletedAt" IS NULL;
CREATE INDEX "Student_organizationId_status_deletedAt_idx" ON "Student"("organizationId", "status", "deletedAt");
CREATE INDEX "Student_organizationId_deletedAt_idx" ON "Student"("organizationId", "deletedAt");
CREATE INDEX "Student_organizationId_name_idx" ON "Student"("organizationId", "name");
CREATE INDEX "Student_userId_idx" ON "Student"("userId");

CREATE INDEX "StudentUnit_organizationId_idx" ON "StudentUnit"("organizationId");
CREATE INDEX "StudentUnit_organizationId_studentId_idx" ON "StudentUnit"("organizationId", "studentId");
CREATE INDEX "StudentUnit_organizationId_unitId_idx" ON "StudentUnit"("organizationId", "unitId");
CREATE INDEX "StudentUnit_organizationId_deletedAt_idx" ON "StudentUnit"("organizationId", "deletedAt");
CREATE UNIQUE INDEX "StudentUnit_unique_active_student_unit"
  ON "StudentUnit"("organizationId", "studentId", "unitId")
  WHERE "deletedAt" IS NULL;

ALTER TABLE "Student"
  ADD CONSTRAINT "Student_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Student"
  ADD CONSTRAINT "Student_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StudentUnit"
  ADD CONSTRAINT "StudentUnit_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StudentUnit"
  ADD CONSTRAINT "StudentUnit_organizationId_studentId_fkey"
  FOREIGN KEY ("organizationId", "studentId") REFERENCES "Student"("organizationId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentUnit"
  ADD CONSTRAINT "StudentUnit_organizationId_unitId_fkey"
  FOREIGN KEY ("organizationId", "unitId") REFERENCES "Unit"("organizationId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrganizationSubscription"
  ADD CONSTRAINT "OrganizationSubscription_valid_period_chk"
  CHECK ("endsAt" IS NULL OR "endsAt" > "startsAt");

DROP INDEX IF EXISTS "OrganizationSubscription_single_open_effective_idx";

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "OrganizationSubscription"
  ADD CONSTRAINT "OrganizationSubscription_effective_period_no_overlap"
  EXCLUDE USING gist (
    "organizationId" WITH =,
    tsrange("startsAt", COALESCE("endsAt", 'infinity'::timestamp), '[)') WITH &&
  )
  WHERE ("status" IN ('TRIALING', 'ACTIVE'));
