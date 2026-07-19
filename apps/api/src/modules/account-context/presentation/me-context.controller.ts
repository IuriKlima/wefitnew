import { Controller, Get, Inject, Req } from "@nestjs/common";

import type { AuthenticatedActor } from "@gym-platform/auth";

import { CurrentActor } from "../../../common/auth/current-actor.decorator.js";
import type { RequestWithContext } from "../../../common/request-context/request-context.js";
import { GetCurrentAccountContextUseCase } from "../application/get-current-account-context.use-case.js";

@Controller("me/context")
export class MeContextController {
  constructor(
    @Inject(GetCurrentAccountContextUseCase)
    private readonly getCurrentAccountContextUseCase: GetCurrentAccountContextUseCase
  ) {}

  @Get()
  getCurrentContext(@CurrentActor() actor: AuthenticatedActor, @Req() request: RequestWithContext) {
    return this.getCurrentAccountContextUseCase.execute(actor.userId, request.correlationId ?? "");
  }
}
