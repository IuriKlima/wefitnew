import { Inject, Injectable } from "@nestjs/common";

import type { AuthAdapter, AuthHeaders, AuthenticatedActor } from "@gym-platform/auth";

import { AUTH_ADAPTER } from "../../common/auth/auth.constants.js";

@Injectable()
export class IdentityService {
  constructor(@Inject(AUTH_ADAPTER) private readonly authAdapter: AuthAdapter) {}

  resolveActor(headers: AuthHeaders): Promise<AuthenticatedActor | null> {
    return this.authAdapter.resolveActor(headers);
  }
}
