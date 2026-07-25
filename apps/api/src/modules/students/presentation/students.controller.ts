import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req
} from "@nestjs/common";
import { z } from "zod";

import type { AuthenticatedActor } from "@gym-platform/auth";
import { permissionKeys } from "@gym-platform/permissions";
import {
  createStudentSchema,
  listStudentsQuerySchema,
  replaceStudentUnitsSchema,
  updateStudentSchema
} from "@gym-platform/validation";

import { CurrentActor } from "../../../common/auth/current-actor.decorator.js";
import { RequireOrganizationScope } from "../../../common/auth/require-organization-scope.decorator.js";
import { RequirePermissions } from "../../../common/auth/require-permissions.decorator.js";
import type { RequestWithContext } from "../../../common/request-context/request-context.js";
import { CreateStudentUseCase } from "../application/create-student.use-case.js";
import { GetStudentUseCase } from "../application/get-student.use-case.js";
import { GetStudentDashboardSummaryUseCase } from "../application/get-student-dashboard-summary.use-case.js";
import { ListStudentHistoryUseCase } from "../application/list-student-history.use-case.js";
import { ListStudentsUseCase } from "../application/list-students.use-case.js";
import { ReplaceStudentUnitsUseCase } from "../application/replace-student-units.use-case.js";
import { SetStudentStatusUseCase } from "../application/set-student-status.use-case.js";
import { UpdateStudentUseCase } from "../application/update-student.use-case.js";

const studentRouteParamsSchema = z.object({
  organizationId: z.string().uuid(),
  studentId: z.string().uuid().optional()
});

const createStudentBodySchema = createStudentSchema.omit({
  organizationId: true
});

@Controller("organizations/:organizationId/students")
export class StudentsController {
  constructor(
    @Inject(CreateStudentUseCase)
    private readonly createStudentUseCase: CreateStudentUseCase,
    @Inject(ListStudentsUseCase)
    private readonly listStudentsUseCase: ListStudentsUseCase,
    @Inject(GetStudentDashboardSummaryUseCase)
    private readonly getStudentDashboardSummaryUseCase: GetStudentDashboardSummaryUseCase,
    @Inject(GetStudentUseCase)
    private readonly getStudentUseCase: GetStudentUseCase,
    @Inject(ListStudentHistoryUseCase)
    private readonly listStudentHistoryUseCase: ListStudentHistoryUseCase,
    @Inject(UpdateStudentUseCase)
    private readonly updateStudentUseCase: UpdateStudentUseCase,
    @Inject(ReplaceStudentUnitsUseCase)
    private readonly replaceStudentUnitsUseCase: ReplaceStudentUnitsUseCase,
    @Inject(SetStudentStatusUseCase)
    private readonly setStudentStatusUseCase: SetStudentStatusUseCase
  ) {}

  @Post()
  @RequirePermissions(permissionKeys.studentManage)
  @RequireOrganizationScope()
  create(
    @Param() params: unknown,
    @Body() body: unknown,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: RequestWithContext
  ) {
    const routeParams = studentRouteParamsSchema.parse(params);
    const parsedBody = createStudentBodySchema.parse(body);

    return this.createStudentUseCase.execute(
      {
        ...parsedBody,
        organizationId: routeParams.organizationId
      },
      actor.userId,
      request.correlationId ?? ""
    );
  }

  @Get()
  @RequirePermissions(permissionKeys.studentRead)
  list(
    @Param() params: unknown,
    @Query() query: unknown,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: RequestWithContext
  ) {
    const routeParams = studentRouteParamsSchema.parse(params);
    const parsedQuery = listStudentsQuerySchema.parse(query);

    return this.listStudentsUseCase.execute(
      routeParams.organizationId,
      parsedQuery,
      actor.userId,
      request.correlationId ?? "",
      request.requestContext?.unitId
    );
  }

  @Get("summary")
  @RequirePermissions(permissionKeys.studentRead)
  getDashboardSummary(
    @Param() params: unknown,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: RequestWithContext
  ) {
    const routeParams = studentRouteParamsSchema.parse(params);

    return this.getStudentDashboardSummaryUseCase.execute(
      routeParams.organizationId,
      actor.userId,
      request.correlationId ?? "",
      request.requestContext?.unitId
    );
  }

  @Get(":studentId")
  @RequirePermissions(permissionKeys.studentRead)
  getById(
    @Param() params: unknown,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: RequestWithContext
  ) {
    const routeParams = studentRouteParamsSchema.required({ studentId: true }).parse(params);

    return this.getStudentUseCase.execute(
      routeParams.organizationId,
      routeParams.studentId,
      actor.userId,
      request.correlationId ?? "",
      request.requestContext?.unitId
    );
  }

  @Get(":studentId/history")
  @RequirePermissions(permissionKeys.studentRead)
  listHistory(
    @Param() params: unknown,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: RequestWithContext
  ) {
    const routeParams = studentRouteParamsSchema.required({ studentId: true }).parse(params);

    return this.listStudentHistoryUseCase.execute(
      routeParams.organizationId,
      routeParams.studentId,
      actor.userId,
      request.correlationId ?? "",
      request.requestContext?.unitId
    );
  }

  @Patch(":studentId")
  @RequirePermissions(permissionKeys.studentManage)
  @RequireOrganizationScope()
  update(
    @Param() params: unknown,
    @Body() body: unknown,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: RequestWithContext
  ) {
    const routeParams = studentRouteParamsSchema.required({ studentId: true }).parse(params);
    const parsedBody = updateStudentSchema.parse(body);

    return this.updateStudentUseCase.execute(
      routeParams.organizationId,
      routeParams.studentId,
      parsedBody,
      actor.userId,
      request.correlationId ?? ""
    );
  }

  @Put(":studentId/units")
  @RequirePermissions(permissionKeys.studentManage)
  @RequireOrganizationScope()
  replaceUnits(
    @Param() params: unknown,
    @Body() body: unknown,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: RequestWithContext
  ) {
    const routeParams = studentRouteParamsSchema.required({ studentId: true }).parse(params);
    const parsedBody = replaceStudentUnitsSchema.parse(body);

    return this.replaceStudentUnitsUseCase.execute(
      routeParams.organizationId,
      routeParams.studentId,
      parsedBody,
      actor.userId,
      request.correlationId ?? ""
    );
  }

  @Post(":studentId/inactivate")
  @HttpCode(200)
  @RequirePermissions(permissionKeys.studentManage)
  @RequireOrganizationScope()
  inactivate(
    @Param() params: unknown,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: RequestWithContext
  ) {
    const routeParams = studentRouteParamsSchema.required({ studentId: true }).parse(params);

    return this.setStudentStatusUseCase.execute(
      routeParams.organizationId,
      routeParams.studentId,
      "INACTIVE",
      actor.userId,
      request.correlationId ?? ""
    );
  }

  @Post(":studentId/reactivate")
  @HttpCode(200)
  @RequirePermissions(permissionKeys.studentManage)
  @RequireOrganizationScope()
  reactivate(
    @Param() params: unknown,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: RequestWithContext
  ) {
    const routeParams = studentRouteParamsSchema.required({ studentId: true }).parse(params);

    return this.setStudentStatusUseCase.execute(
      routeParams.organizationId,
      routeParams.studentId,
      "ACTIVE",
      actor.userId,
      request.correlationId ?? ""
    );
  }
}
