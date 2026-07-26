import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module.js";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module.js";
import { CreateStudentUseCase } from "./application/create-student.use-case.js";
import { GetStudentUseCase } from "./application/get-student.use-case.js";
import { GetStudentDashboardSummaryUseCase } from "./application/get-student-dashboard-summary.use-case.js";
import { ListStudentHistoryUseCase } from "./application/list-student-history.use-case.js";
import { ListStudentsUseCase } from "./application/list-students.use-case.js";
import { ReplaceStudentUnitsUseCase } from "./application/replace-student-units.use-case.js";
import { SetStudentStatusUseCase } from "./application/set-student-status.use-case.js";
import { StudentManagementPolicy } from "./application/student-management.policy.js";
import { StudentsRepository } from "./application/students.repository.js";
import { UpdateStudentUseCase } from "./application/update-student.use-case.js";
import { StudentsController } from "./presentation/students.controller.js";

@Module({
  imports: [AuditModule, SubscriptionsModule],
  controllers: [StudentsController],
  providers: [
    StudentsRepository,
    CreateStudentUseCase,
    ListStudentsUseCase,
    GetStudentDashboardSummaryUseCase,
    GetStudentUseCase,
    ListStudentHistoryUseCase,
    UpdateStudentUseCase,
    ReplaceStudentUnitsUseCase,
    SetStudentStatusUseCase,
    StudentManagementPolicy
  ],
  exports: [StudentsRepository]
})
export class StudentsModule {}
