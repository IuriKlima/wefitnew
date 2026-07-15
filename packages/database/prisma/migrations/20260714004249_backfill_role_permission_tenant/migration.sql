-- DropForeignKey
ALTER TABLE "RolePermission" DROP CONSTRAINT "RolePermission_roleId_fkey";

-- AlterTable
ALTER TABLE "RolePermission" ADD COLUMN "organizationId" UUID;

-- Backfill organizationId from Role
UPDATE "RolePermission" AS rp
SET "organizationId" = r."organizationId"
FROM "Role" AS r
WHERE rp."roleId" = r."id";

-- Make it NOT NULL
ALTER TABLE "RolePermission" ALTER COLUMN "organizationId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "RolePermission_organizationId_idx" ON "RolePermission"("organizationId");
CREATE INDEX "RolePermission_organizationId_roleId_idx" ON "RolePermission"("organizationId", "roleId");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_organizationId_roleId_fkey" FOREIGN KEY ("organizationId", "roleId") REFERENCES "Role"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
