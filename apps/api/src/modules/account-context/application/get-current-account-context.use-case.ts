import { Inject, Injectable } from "@nestjs/common";

import type { CurrentAccountContext } from "@gym-platform/contracts";

import { AccountContextRepository } from "./account-context.repository.js";

@Injectable()
export class GetCurrentAccountContextUseCase {
  constructor(
    @Inject(AccountContextRepository)
    private readonly accountContextRepository: AccountContextRepository
  ) {}

  execute(actorUserId: string, correlationId: string): Promise<CurrentAccountContext> {
    return this.accountContextRepository.findByActor(actorUserId, correlationId);
  }
}
