import { Module } from "@nestjs/common";

import { RateLimitModule } from "../../common/rate-limit/rate-limit.module.js";
import { AuditModule } from "../audit/audit.module.js";
import { OnboardingService } from "./application/onboarding.service.js";
import { OnboardingRepository } from "./infrastructure/onboarding.repository.js";
import { OnboardingController } from "./presentation/onboarding.controller.js";

@Module({
  imports: [AuditModule, RateLimitModule],
  controllers: [OnboardingController],
  providers: [OnboardingRepository, OnboardingService]
})
export class OnboardingModule {}
