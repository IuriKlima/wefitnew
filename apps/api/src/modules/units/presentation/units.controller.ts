import { Body, Controller, Get, Inject, Param, Post, Req } from "@nestjs/common";
import { z } from "zod";

import type { AuthenticatedActor } from "@gym-platform/auth";
import { permissionKeys } from "@gym-platform/permissions";
import { createUnitSchema } from "@gym-platform/validation";

import { CurrentActor } from "../../../common/auth/current-actor.decorator.js";
import { RequireOrganizationScope } from "../../../common/auth/require-organization-scope.decorator.js";
import { RequirePermissions } from "../../../common/auth/require-permissions.decorator.js";
import type { RequestWithContext } from "../../../common/request-context/request-context.js";
import { CreateUnitUseCase } from "../application/create-unit.use-case.js";
import { GetUnitUseCase } from "../application/get-unit.use-case.js";
import { ListUnitsUseCase } from "../application/list-units.use-case.js";

const unitRouteParamsSchema = z.object({
  organizationId: z.string().uuid(),
  unitId: z.string().uuid().optional()
});

const createUnitBodySchema = createUnitSchema.omit({
  organizationId: true
});

@Controller("organizations/:organizationId/units")
export class UnitsController {
  constructor(
    @Inject(CreateUnitUseCase)
    private readonly createUnitUseCase: CreateUnitUseCase,
    @Inject(GetUnitUseCase)
    private readonly getUnitUseCase: GetUnitUseCase,
    @Inject(ListUnitsUseCase)
    private readonly listUnitsUseCase: ListUnitsUseCase
  ) {}

  @Post()
  @RequirePermissions(permissionKeys.unitManage)
  @RequireOrganizationScope()
  create(
    @Param() params: unknown,
    @Body() body: unknown,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: RequestWithContext
  ) {
    const routeParams = unitRouteParamsSchema.parse(params);
    const parsedBody = createUnitBodySchema.parse(body);

    return this.createUnitUseCase.execute(
      {
        ...parsedBody,
        organizationId: routeParams.organizationId
      },
      actor.userId,
      request.correlationId ?? ""
    );
  }

  @Get()
  @RequirePermissions(permissionKeys.unitRead)
  list(@Param() params: unknown, @Req() request: RequestWithContext) {
    const routeParams = unitRouteParamsSchema.parse(params);

    return this.listUnitsUseCase.execute(
      routeParams.organizationId,
      request.requestContext?.unitId
    );
  }

  @Get(":unitId")
  @RequirePermissions(permissionKeys.unitRead)
  getById(@Param() params: unknown) {
    const routeParams = unitRouteParamsSchema.required({ unitId: true }).parse(params);

    return this.getUnitUseCase.execute(routeParams.organizationId, routeParams.unitId);
  }
}
