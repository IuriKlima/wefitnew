import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module.js";
import { OnboardingService } from "./application/onboarding.service.js";
import { OnboardingRepository } from "./infrastructure/onboarding.repository.js";
import { OnboardingController } from "./presentation/onboarding.controller.js";

@Module({
  imports: [AuditModule],
  controllers: [OnboardingController],
  providers: [OnboardingRepository, OnboardingService]
})
export class OnboardingModule {}
