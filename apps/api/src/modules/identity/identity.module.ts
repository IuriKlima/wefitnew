import { Module } from "@nestjs/common";

import { TemporaryHeaderAuthAdapter } from "@gym-platform/auth";
import { loadApiEnv } from "@gym-platform/config";

import { AUTH_ADAPTER } from "../../common/auth/auth.constants.js";
import { IdentityService } from "./identity.service.js";

@Module({
  providers: [
    {
      provide: AUTH_ADAPTER,
      useFactory: () => {
        const env = loadApiEnv();

        if (env.AUTH_ADAPTER !== "temporary-header") {
          throw new Error("Production authentication provider is not configured yet.");
        }

        return new TemporaryHeaderAuthAdapter();
      }
    },
    IdentityService
  ],
  exports: [IdentityService]
})
export class IdentityModule {}
