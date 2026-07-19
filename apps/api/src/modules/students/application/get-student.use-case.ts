import { Inject, Injectable } from "@nestjs/common";

import type { Student } from "@gym-platform/contracts";
import { permissionKeys } from "@gym-platform/permissions";

import { PrismaService } from "../../../infrastructure/database/prisma.service.js";
import { StudentsRepository } from "./students.repository.js";

@Injectable()
export class GetStudentUseCase {
  constructor(
    @Inject(StudentsRepository) private readonly studentsRepository: StudentsRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  execute(
    organizationId: string,
    studentId: string,
    actorUserId: string,
    correlationId: string,
    unitId?: string
  ): Promise<Student> {
    return this.prisma.withAuthorizedTenantTransaction(
      {
        organizationId,
        actorUserId,
        correlationId,
        permission: permissionKeys.studentRead,
        permissionScope: "contextual",
        ...(unitId ? { unitId } : {})
      },
      (transaction) => this.studentsRepository.get(transaction, organizationId, studentId, unitId)
    );
  }
}
