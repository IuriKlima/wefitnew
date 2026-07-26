import { Inject, Injectable } from "@nestjs/common";

import type { Student, StudentStatus } from "@gym-platform/contracts";
import { permissionKeys } from "@gym-platform/permissions";

import { PrismaService } from "../../../infrastructure/database/prisma.service.js";
import { StudentManagementPolicy } from "./student-management.policy.js";
import { StudentsRepository } from "./students.repository.js";

@Injectable()
export class SetStudentStatusUseCase {
  constructor(
    @Inject(StudentsRepository) private readonly studentsRepository: StudentsRepository,
    @Inject(StudentManagementPolicy)
    private readonly studentManagementPolicy: StudentManagementPolicy,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  execute(
    organizationId: string,
    studentId: string,
    status: StudentStatus,
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
      async (transaction) => {
        await this.studentManagementPolicy.assertEntitled(transaction, organizationId);
        return this.studentsRepository.setStatus(
          transaction,
          organizationId,
          studentId,
          status,
          actorUserId,
          correlationId
        );
      }
    );
  }
}
