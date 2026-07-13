import { Inject, Injectable } from "@nestjs/common";

import type { Student } from "@gym-platform/contracts";

import { StudentsRepository } from "./students.repository.js";

@Injectable()
export class ArchiveStudentUseCase {
  constructor(
    @Inject(StudentsRepository) private readonly studentsRepository: StudentsRepository
  ) {}

  execute(
    organizationId: string,
    studentId: string,
    actorUserId: string,
    correlationId: string
  ): Promise<Student> {
    return this.studentsRepository.archive(organizationId, studentId, actorUserId, correlationId);
  }
}
