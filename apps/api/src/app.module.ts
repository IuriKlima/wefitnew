import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { loadApiEnv } from "@gym-platform/config";

import { AuthGuard } from "./common/auth/auth.guard.js";
import { AuthorizationGuard } from "./common/auth/authorization.guard.js";
import { AuditModule } from "./modules/audit/audit.module.js";
import { AuthorizationModule } from "./modules/authorization/authorization.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { IdentityModule } from "./modules/identity/identity.module.js";
import { MembershipsModule } from "./modules/memberships/memberships.module.js";
import { OnboardingModule } from "./modules/onboarding/onboarding.module.js";
import { OrganizationsModule } from "./modules/organizations/organizations.module.js";
import { StudentsModule } from "./modules/students/students.module.js";
import { SubscriptionsModule } from "./modules/subscriptions/subscriptions.module.js";
import { UnitsModule } from "./modules/units/units.module.js";
import { PrismaModule } from "./infrastructure/database/prisma.module.js";
import { AccountContextModule } from "./modules/account-context/account-context.module.js";

export const API_ENV = Symbol("API_ENV");

@Module({
  imports: [
    PrismaModule,
    AccountContextModule,
    HealthModule,
    OrganizationsModule,
    StudentsModule,
    UnitsModule,
    IdentityModule,
    MembershipsModule,
    OnboardingModule,
    AuthorizationModule,
    SubscriptionsModule,
    AuditModule
  ],
  providers: [
    {
      provide: API_ENV,
      useFactory: loadApiEnv
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard
    },
    {
      provide: APP_GUARD,
      useClass: AuthorizationGuard
    }
  ]
})
export class AppModule {}
