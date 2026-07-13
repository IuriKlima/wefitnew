import { Inject, Injectable } from "@nestjs/common";

import { DomainError } from "../../common/errors/domain-error.js";
import { PrismaService } from "../../infrastructure/database/prisma.service.js";

@Injectable()
export class MembershipsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async assertActiveMembership(userId: string, organizationId: string): Promise<void> {
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        organizationId,
        status: "ACTIVE",
        deletedAt: null
      },
      select: {
        id: true
      }
    });

    if (!membership) {
      throw new DomainError("Active membership not found.", "ACTIVE_MEMBERSHIP_NOT_FOUND", 403);
    }
  }
}
