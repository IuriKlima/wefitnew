import { Module } from "@nestjs/common";

import { SupabaseJwtAuthAdapter, TemporaryHeaderAuthAdapter } from "@gym-platform/auth";
import { loadApiEnv } from "@gym-platform/config";

import { AUTH_ADAPTER } from "../../common/auth/auth.constants.js";
import { IdentityService } from "./identity.service.js";

@Module({
  providers: [
    {
      provide: AUTH_ADAPTER,
      useFactory: () => {
        const env = loadApiEnv();

        if (env.AUTH_ADAPTER === "supabase-jwt") {
          return new SupabaseJwtAuthAdapter(env.SUPABASE_JWKS_URL!, env.SUPABASE_URL!);
        }

        if (env.AUTH_ADAPTER === "temporary-header") {
          return new TemporaryHeaderAuthAdapter();
        }

        throw new Error("Configured authentication adapter is not implemented.");
      }
    },
    IdentityService
  ],
  exports: [IdentityService]
})
export class IdentityModule {}
