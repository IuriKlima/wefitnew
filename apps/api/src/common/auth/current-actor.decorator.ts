import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

import type { AuthenticatedActor } from "@gym-platform/auth";

import type { RequestWithContext } from "../request-context/request-context.js";

export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedActor => {
    const request = context.switchToHttp().getRequest<RequestWithContext>();

    if (!request.actor) {
      throw new Error("CurrentActor used without an authenticated actor.");
    }

    return request.actor;
  }
);
