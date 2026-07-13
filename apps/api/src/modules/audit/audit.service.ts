import { Inject, Injectable } from "@nestjs/common";

import { Prisma } from "@gym-platform/database";

import { DomainError } from "../../common/errors/domain-error.js";
import { PrismaService } from "../../infrastructure/database/prisma.service.js";

const maxMetadataBytes = 8192;
const sensitiveMetadataKeys = new Set(
  ["authorization", "cookie", "password", "token", "secret", "accessToken", "refreshToken"].map(
    (key) => key.toLowerCase()
  )
);

type AuditInput = {
  organizationId: string;
  unitId?: string;
  actorUserId?: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Prisma.InputJsonObject;
  correlationId?: string;
};

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(input: AuditInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        unitId: input.unitId ?? null,
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        metadata: input.metadata ? sanitizeAuditMetadata(input.metadata) : Prisma.JsonNull,
        correlationId: input.correlationId ?? null
      }
    });
  }
}

export function sanitizeAuditMetadata(metadata: Prisma.InputJsonObject): Prisma.InputJsonObject {
  const sanitized = sanitizeObject(metadata);
  const size = Buffer.byteLength(JSON.stringify(sanitized), "utf8");

  if (size > maxMetadataBytes) {
    throw new DomainError("Audit metadata is too large.", "AUDIT_METADATA_TOO_LARGE", 400);
  }

  return sanitized;
}

function sanitizeObject(input: Prisma.InputJsonObject): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(input).flatMap(([key, value]) => {
      if (value === undefined) {
        return [];
      }

      return [
        [key, sensitiveMetadataKeys.has(key.toLowerCase()) ? "[REDACTED]" : sanitizeValue(value)]
      ];
    })
  ) as Prisma.InputJsonObject;
}

function sanitizeValue(
  value: Prisma.InputJsonValue | null | undefined
): Prisma.InputJsonValue | null {
  if (value === undefined) {
    return null;
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  return sanitizeObject(value as Prisma.InputJsonObject);
}
