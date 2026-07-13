import { Inject, Injectable } from "@nestjs/common";

import type { PaginatedStudents } from "@gym-platform/contracts";
import type { ListStudentsQueryInput } from "@gym-platform/validation";

import { StudentsRepository } from "./students.repository.js";

@Injectable()
export class ListStudentsUseCase {
  constructor(
    @Inject(StudentsRepository) private readonly studentsRepository: StudentsRepository
  ) {}

  execute(
    organizationId: string,
    query: ListStudentsQueryInput,
    unitId?: string
  ): Promise<PaginatedStudents> {
    return this.studentsRepository.list(organizationId, query, unitId);
  }
}
