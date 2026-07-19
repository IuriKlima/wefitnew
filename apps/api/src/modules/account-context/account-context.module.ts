import { Module } from "@nestjs/common";

import { AccountContextRepository } from "./application/account-context.repository.js";
import { GetCurrentAccountContextUseCase } from "./application/get-current-account-context.use-case.js";
import { MeContextController } from "./presentation/me-context.controller.js";

@Module({
  controllers: [MeContextController],
  providers: [AccountContextRepository, GetCurrentAccountContextUseCase]
})
export class AccountContextModule {}
