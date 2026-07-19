import { Inject, Injectable } from "@nestjs/common";

import {
  resolveFeatureEntitlement,
  type ResolvedFeatureEntitlement
} from "@gym-platform/contracts";
import { Prisma, type PrismaClient } from "@gym-platform/database";

import { PrismaService } from "../../infrastructure/database/prisma.service.js";

type ResolvedOrganizationFeature = {
  hasEffectiveSubscription: boolean;
  entitlement: ResolvedFeatureEntitlement;
};

@Injectable()
export class SubscriptionsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaClient) {}

  async resolveFeature(
    organizationId: string,
    featureKey: string,
    client: PrismaClient | Prisma.TransactionClient = this.prisma
  ): Promise<ResolvedFeatureEntitlement> {
    return (await this.resolveOrganizationFeature(organizationId, featureKey, client)).entitlement;
  }

  async resolveOrganizationFeature(
    organizationId: string,
    featureKey: string,
    client: PrismaClient | Prisma.TransactionClient = this.prisma
  ): Promise<ResolvedOrganizationFeature> {
    const now = new Date();
    const subscription = await client.organizationSubscription.findFirst({
      where: {
        organizationId,
        status: {
          in: ["TRIALING", "ACTIVE"]
        },
        startsAt: {
          lte: now
        },
        OR: [
          {
            endsAt: null
          },
          {
            endsAt: {
              gt: new Date()
            }
          }
        ]
      },
      orderBy: {
        startsAt: "desc"
      },
      include: {
        plan: {
          include: {
            planFeatures: {
              include: {
                feature: true
              }
            }
          }
        }
      }
    });

    const features =
      subscription?.plan.planFeatures.map((planFeature) => ({
        key: planFeature.feature.key,
        enabled: planFeature.enabled,
        limitValue: planFeature.limitValue,
        config:
          typeof planFeature.config === "object" && planFeature.config !== null
            ? (planFeature.config as Record<string, unknown>)
            : {}
      })) ?? [];

    return {
      hasEffectiveSubscription: Boolean(subscription),
      entitlement: resolveFeatureEntitlement(features, featureKey)
    };
  }
}
