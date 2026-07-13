import { Inject, Injectable } from "@nestjs/common";

import type { Student } from "@gym-platform/contracts";
import type { CreateStudentInput } from "@gym-platform/validation";

import { StudentsRepository } from "./students.repository.js";

@Injectable()
export class CreateStudentUseCase {
  constructor(
    @Inject(StudentsRepository) private readonly studentsRepository: StudentsRepository
  ) {}

  execute(input: CreateStudentInput, actorUserId: string, correlationId: string): Promise<Student> {
    return this.studentsRepository.create(input, actorUserId, correlationId);
  }
}
