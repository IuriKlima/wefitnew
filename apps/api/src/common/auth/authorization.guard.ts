import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  ForbiddenException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { z } from "zod";

import {
  REQUIRED_PERMISSIONS,
  REQUIRED_PERMISSION_SCOPE,
  type PermissionScope
} from "./auth.constants.js";
import { AuthorizationService } from "../../modules/authorization/authorization.service.js";
import { readRouteParam, type RequestWithContext } from "../request-context/request-context.js";

const uuidSchema = z.string().uuid();

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(AuthorizationService) private readonly authorizationService: AuthorizationService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permissions =
      this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [
        context.getHandler(),
        context.getClass()
      ]) ?? [];

    if (permissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithContext>();

    if (!request.actor) {
      throw new ForbiddenException("Authenticated actor is missing.");
    }

    const organizationId = this.readOrganizationId(request);
    const permissionScope =
      this.reflector.getAllAndOverride<PermissionScope>(REQUIRED_PERMISSION_SCOPE, [
        context.getHandler(),
        context.getClass()
      ]) ?? "contextual";
    const unitId = permissionScope === "organization" ? undefined : this.readUnitId(request);

    for (const permission of permissions) {
      const authorizationInput = {
        userId: request.actor.userId,
        organizationId,
        permission
      };

      const allowed = await this.authorizationService.can(
        unitId ? { ...authorizationInput, unitId } : authorizationInput
      );

      if (!allowed) {
        throw new ForbiddenException("Permission denied.");
      }
    }

    const requestContext = {
      actorUserId: request.actor.userId,
      organizationId,
      correlationId: request.correlationId ?? ""
    };

    request.requestContext = unitId ? { ...requestContext, unitId } : requestContext;

    return true;
  }

  private readOrganizationId(request: RequestWithContext): string {
    const value =
      readRouteParam(request, "organizationId") ?? this.readHeader(request, "x-organization-id");

    const result = uuidSchema.safeParse(value);

    if (!result.success) {
      throw new ForbiddenException("Valid organization context is required.");
    }

    return result.data;
  }

  private readUnitId(request: RequestWithContext): string | undefined {
    const value = readRouteParam(request, "unitId") ?? this.readHeader(request, "x-unit-id");

    if (!value) {
      return undefined;
    }

    const result = uuidSchema.safeParse(value);

    if (!result.success) {
      throw new ForbiddenException("Valid unit context is required.");
    }

    return result.data;
  }

  private readHeader(request: RequestWithContext, name: string): string | undefined {
    const value = request.headers[name];

    return Array.isArray(value) ? value[0] : value;
  }
}
