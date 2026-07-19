import { Inject, Injectable } from "@nestjs/common";

import type { PaginatedStudents } from "@gym-platform/contracts";
import { permissionKeys } from "@gym-platform/permissions";
import type { ListStudentsQueryInput } from "@gym-platform/validation";

import { PrismaService } from "../../../infrastructure/database/prisma.service.js";
import { StudentsRepository } from "./students.repository.js";

@Injectable()
export class ListStudentsUseCase {
  constructor(
    @Inject(StudentsRepository) private readonly studentsRepository: StudentsRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  execute(
    organizationId: string,
    query: ListStudentsQueryInput,
    actorUserId: string,
    correlationId: string,
    unitId?: string
  ): Promise<PaginatedStudents> {
    return this.prisma.withAuthorizedTenantTransaction(
      {
        organizationId,
        actorUserId,
        correlationId,
        permission: permissionKeys.studentRead,
        permissionScope: "contextual",
        ...(unitId ? { unitId } : {})
      },
      (transaction) => this.studentsRepository.list(transaction, organizationId, query, unitId)
    );
  }
}
