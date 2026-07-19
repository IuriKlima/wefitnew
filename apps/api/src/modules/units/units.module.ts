import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module.js";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module.js";
import { CreateUnitUseCase } from "./application/create-unit.use-case.js";
import { GetUnitUseCase } from "./application/get-unit.use-case.js";
import { ListUnitsUseCase } from "./application/list-units.use-case.js";
import { UnitsRepository } from "./application/units.repository.js";
import { UnitsController } from "./presentation/units.controller.js";

@Module({
  imports: [AuditModule, SubscriptionsModule],
  controllers: [UnitsController],
  providers: [CreateUnitUseCase, GetUnitUseCase, ListUnitsUseCase, UnitsRepository],
  exports: [UnitsRepository]
})
export class UnitsModule {}
