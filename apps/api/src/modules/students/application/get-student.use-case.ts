import { Inject, Injectable } from "@nestjs/common";

import type { Student } from "@gym-platform/contracts";

import { StudentsRepository } from "./students.repository.js";

@Injectable()
export class GetStudentUseCase {
  constructor(
    @Inject(StudentsRepository) private readonly studentsRepository: StudentsRepository
  ) {}

  execute(organizationId: string, studentId: string, unitId?: string): Promise<Student> {
    return this.studentsRepository.get(organizationId, studentId, unitId);
  }
}
