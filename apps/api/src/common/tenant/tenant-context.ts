import type { FastifyRequest } from "fastify";

import { tenantContextSchema, type TenantContextInput } from "@gym-platform/validation";

export function readTenantContext(request: FastifyRequest): TenantContextInput {
  const organizationId = request.headers["x-organization-id"];
  const unitId = request.headers["x-unit-id"];

  return tenantContextSchema.parse({
    organizationId: Array.isArray(organizationId) ? organizationId[0] : organizationId,
    unitId: Array.isArray(unitId) ? unitId[0] : unitId
  });
}
