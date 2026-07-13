import { Inject, Injectable } from "@nestjs/common";

import type { Student } from "@gym-platform/contracts";
import type { UpdateStudentInput } from "@gym-platform/validation";

import { StudentsRepository } from "./students.repository.js";

@Injectable()
export class UpdateStudentUseCase {
  constructor(
    @Inject(StudentsRepository) private readonly studentsRepository: StudentsRepository
  ) {}

  execute(
    organizationId: string,
    studentId: string,
    input: UpdateStudentInput,
    actorUserId: string,
    correlationId: string
  ): Promise<Student> {
    return this.studentsRepository.update(
      organizationId,
      studentId,
      input,
      actorUserId,
      correlationId
    );
  }
}
