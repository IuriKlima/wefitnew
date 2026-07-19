import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module.js";
import { ArchiveStudentUseCase } from "./application/archive-student.use-case.js";
import { CreateStudentUseCase } from "./application/create-student.use-case.js";
import { GetStudentUseCase } from "./application/get-student.use-case.js";
import { ListStudentsUseCase } from "./application/list-students.use-case.js";
import { StudentsRepository } from "./application/students.repository.js";
import { UpdateStudentUseCase } from "./application/update-student.use-case.js";
import { StudentsController } from "./presentation/students.controller.js";

@Module({
  imports: [AuditModule],
  controllers: [StudentsController],
  providers: [
    StudentsRepository,
    CreateStudentUseCase,
    ListStudentsUseCase,
    GetStudentUseCase,
    UpdateStudentUseCase,
    ArchiveStudentUseCase
  ],
  exports: [StudentsRepository]
})
export class StudentsModule {}
