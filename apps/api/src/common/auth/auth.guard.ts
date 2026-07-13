import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { IS_PUBLIC_ROUTE } from "./auth.constants.js";
import { IdentityService } from "../../modules/identity/identity.service.js";
import type { RequestWithContext } from "../request-context/request-context.js";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(IdentityService) private readonly identityService: IdentityService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithContext>();
    const actor = await this.identityService.resolveActor(request.headers);

    if (!actor) {
      throw new UnauthorizedException("Authentication is required.");
    }

    request.actor = actor;
    request.requestContext = {
      ...request.requestContext,
      actorUserId: actor.userId,
      correlationId: request.correlationId ?? ""
    };

    return true;
  }
}
