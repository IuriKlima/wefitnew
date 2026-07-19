import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req
} from "@nestjs/common";
import { z } from "zod";

import type { AuthenticatedActor } from "@gym-platform/auth";
import { permissionKeys } from "@gym-platform/permissions";
import {
  createStudentSchema,
  listStudentsQuerySchema,
  updateStudentSchema
} from "@gym-platform/validation";

import { CurrentActor } from "../../../common/auth/current-actor.decorator.js";
import { RequireOrganizationScope } from "../../../common/auth/require-organization-scope.decorator.js";
import { RequirePermissions } from "../../../common/auth/require-permissions.decorator.js";
import type { RequestWithContext } from "../../../common/request-context/request-context.js";
import { ArchiveStudentUseCase } from "../application/archive-student.use-case.js";
import { CreateStudentUseCase } from "../application/create-student.use-case.js";
import { GetStudentUseCase } from "../application/get-student.use-case.js";
import { ListStudentsUseCase } from "../application/list-students.use-case.js";
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
    @Inject(GetStudentUseCase)
    private readonly getStudentUseCase: GetStudentUseCase,
    @Inject(UpdateStudentUseCase)
    private readonly updateStudentUseCase: UpdateStudentUseCase,
    @Inject(ArchiveStudentUseCase)
    private readonly archiveStudentUseCase: ArchiveStudentUseCase
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

  @Delete(":studentId")
  @RequirePermissions(permissionKeys.studentManage)
  @RequireOrganizationScope()
  archive(
    @Param() params: unknown,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() request: RequestWithContext
  ) {
    const routeParams = studentRouteParamsSchema.required({ studentId: true }).parse(params);

    return this.archiveStudentUseCase.execute(
      routeParams.organizationId,
      routeParams.studentId,
      actor.userId,
      request.correlationId ?? ""
    );
  }
}
