import { Inject, Injectable } from "@nestjs/common";

import type { Student } from "@gym-platform/contracts";
import { permissionKeys } from "@gym-platform/permissions";
import type { UpdateStudentInput } from "@gym-platform/validation";

import { PrismaService } from "../../../infrastructure/database/prisma.service.js";
import { StudentsRepository } from "./students.repository.js";

@Injectable()
export class UpdateStudentUseCase {
  constructor(
    @Inject(StudentsRepository) private readonly studentsRepository: StudentsRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  execute(
    organizationId: string,
    studentId: string,
    input: UpdateStudentInput,
    actorUserId: string,
    correlationId: string
  ): Promise<Student> {
    return this.prisma.withAuthorizedTenantTransaction(
      {
        organizationId,
        actorUserId,
        correlationId,
        permission: permissionKeys.studentManage,
        permissionScope: "organization"
      },
      (transaction) =>
        this.studentsRepository.update(
          transaction,
          organizationId,
          studentId,
          input,
          actorUserId,
          correlationId
        )
    );
  }
}
