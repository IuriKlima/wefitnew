import { Inject, Injectable } from "@nestjs/common";

import type { Student } from "@gym-platform/contracts";
import { permissionKeys } from "@gym-platform/permissions";
import type { CreateStudentInput } from "@gym-platform/validation";

import { PrismaService } from "../../../infrastructure/database/prisma.service.js";
import { StudentManagementPolicy } from "./student-management.policy.js";
import { StudentsRepository } from "./students.repository.js";

@Injectable()
export class CreateStudentUseCase {
  constructor(
    @Inject(StudentsRepository) private readonly studentsRepository: StudentsRepository,
    @Inject(StudentManagementPolicy)
    private readonly studentManagementPolicy: StudentManagementPolicy,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  execute(input: CreateStudentInput, actorUserId: string, correlationId: string): Promise<Student> {
    return this.prisma.withAuthorizedTenantTransaction(
      {
        organizationId: input.organizationId,
        actorUserId,
        correlationId,
        permission: permissionKeys.studentManage,
        permissionScope: "organization"
      },
      async (transaction) => {
        await this.studentManagementPolicy.assertEntitled(transaction, input.organizationId);
        return this.studentsRepository.create(transaction, input, actorUserId, correlationId);
      }
    );
  }
}
