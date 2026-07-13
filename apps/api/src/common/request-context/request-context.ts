import type { FastifyRequest } from "fastify";

import type { AuthenticatedActor } from "@gym-platform/auth";

export type RequestContext = {
  actorUserId?: string;
  organizationId?: string;
  unitId?: string;
  correlationId: string;
};

export type RequestWithContext = FastifyRequest & {
  actor?: AuthenticatedActor;
  correlationId?: string;
  requestContext?: RequestContext;
};

export function readRouteParam(request: FastifyRequest, key: string): string | undefined {
  const params = request.params;

  if (!params || typeof params !== "object") {
    return undefined;
  }

  const value = (params as Record<string, unknown>)[key];

  return typeof value === "string" ? value : undefined;
}
