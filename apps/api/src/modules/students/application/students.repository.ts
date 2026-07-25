import { Inject, Injectable } from "@nestjs/common";

import type {
  AccountOrganizationType,
  PaginatedStudents,
  Student,
  StudentAuditAction,
  StudentAuditEvent,
  StudentAuditMetadata,
  StudentDashboardSummary,
  StudentStatus
} from "@gym-platform/contracts";
import { Prisma } from "@gym-platform/database";
import type {
  CreateStudentInput,
  ListStudentsQueryInput,
  ReplaceStudentUnitsInput,
  UpdateStudentInput
} from "@gym-platform/validation";

import { DomainError } from "../../../common/errors/domain-error.js";
import { AuditService } from "../../audit/audit.service.js";

type PrismaClientLike = Prisma.TransactionClient;

const studentUnitInclude = {
  unit: {
    select: {
      id: true,
      name: true,
      code: true
    }
  }
} satisfies Prisma.StudentUnitInclude;

type StudentWithUnits = Prisma.StudentGetPayload<{
  include: {
    unitLinks: {
      include: typeof studentUnitInclude;
    };
  };
}>;

@Injectable()
export class StudentsRepository {
  constructor(@Inject(AuditService) private readonly auditService: AuditService) {}

  async create(
    transaction: Prisma.TransactionClient,
    input: CreateStudentInput,
    actorUserId: string,
    correlationId: string
  ): Promise<Student> {
    await this.assertOrganizationExists(transaction, input.organizationId);
    await this.assertUserExists(transaction, input.userId);
    const unitIds = uniqueIds(input.unitIds);
    await this.assertStudentUnitPolicy(transaction, input.organizationId, unitIds);

    const student = await transaction.student.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId ?? null,
        name: input.name,
        socialName: input.socialName ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        birthDate: input.birthDate ? toBirthDate(input.birthDate) : null,
        operationalNote: input.operationalNote ?? null,
        status: input.status
      }
    });

    if (unitIds.length > 0) {
      await transaction.studentUnit.createMany({
        data: unitIds.map((selectedUnitId) => ({
          organizationId: input.organizationId,
          studentId: student.id,
          unitId: selectedUnitId
        }))
      });
    }

    await this.auditService.record(transaction, {
      organizationId: input.organizationId,
      actorUserId,
      action: "student.created",
      entity: "Student",
      entityId: student.id,
      correlationId,
      metadata: {
        statusAfter: input.status,
        unitIds
      }
    });

    return this.findForOrganization(transaction, input.organizationId, student.id);
  }

  async list(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    query: ListStudentsQueryInput,
    unitId?: string
  ): Promise<PaginatedStudents> {
    const where = buildStudentWhere(organizationId, query, unitId);
    const skip = (query.page - 1) * query.pageSize;
    const effectiveUnitId = unitId ?? query.unitId;
    const include = buildStudentInclude(effectiveUnitId);

    const [total, students] = await Promise.all([
      transaction.student.count({ where }),
      transaction.student.findMany({
        where,
        include,
        orderBy: buildStudentOrderBy(query),
        skip,
        take: query.pageSize
      })
    ]);

    return {
      data: students.map(toStudent),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize))
      }
    };
  }

  async get(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    studentId: string,
    unitId?: string
  ): Promise<Student> {
    return this.findForOrganization(transaction, organizationId, studentId, unitId);
  }

  async getDashboardSummary(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    unitId?: string,
    now = new Date()
  ): Promise<StudentDashboardSummary> {
    const baseWhere = buildStudentWhere(
      organizationId,
      {
        page: 1,
        pageSize: 1,
        sortBy: "createdAt",
        sortDirection: "desc"
      },
      unitId
    );
    const last30Days = new Date(now);
    last30Days.setUTCDate(last30Days.getUTCDate() - 30);

    const [activeStudents, inactiveStudents, totalStudents, newStudentsLast30Days, availableUnits] =
      await Promise.all([
        transaction.student.count({ where: { ...baseWhere, status: "ACTIVE" } }),
        transaction.student.count({ where: { ...baseWhere, status: "INACTIVE" } }),
        transaction.student.count({ where: baseWhere }),
        transaction.student.count({
          where: {
            ...baseWhere,
            createdAt: {
              gte: last30Days
            }
          }
        }),
        transaction.unit.count({
          where: {
            organizationId,
            ...(unitId ? { id: unitId } : {}),
            deletedAt: null
          }
        })
      ]);

    return {
      activeStudents,
      inactiveStudents,
      newStudentsLast30Days,
      totalStudents,
      availableUnits
    };
  }

  async update(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    studentId: string,
    input: UpdateStudentInput,
    actorUserId: string,
    correlationId: string
  ): Promise<Student> {
    const currentStudent = await this.findForOrganization(transaction, organizationId, studentId);
    await this.assertUserExists(transaction, input.userId);

    const data = buildStudentUpdateData(input, currentStudent);
    const changedFields = Object.keys(data);

    if (changedFields.length > 0) {
      await transaction.student.update({
        where: {
          organizationId_id: {
            organizationId,
            id: studentId
          }
        },
        data
      });
      await this.auditService.record(transaction, {
        organizationId,
        actorUserId,
        action: "student.updated",
        entity: "Student",
        entityId: studentId,
        correlationId,
        metadata: {
          changedFields
        }
      });
    }

    return this.findForOrganization(transaction, organizationId, studentId);
  }

  async setStatus(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    studentId: string,
    status: StudentStatus,
    actorUserId: string,
    correlationId: string
  ): Promise<Student> {
    const currentStudent = await this.findForOrganization(transaction, organizationId, studentId);
    if (currentStudent.status === status) {
      return currentStudent;
    }

    await transaction.student.update({
      where: {
        organizationId_id: {
          organizationId,
          id: studentId
        }
      },
      data: {
        status
      }
    });

    await this.auditService.record(transaction, {
      organizationId,
      actorUserId,
      action: status === "ACTIVE" ? "student.reactivated" : "student.inactivated",
      entity: "Student",
      entityId: studentId,
      correlationId,
      metadata: {
        statusBefore: currentStudent.status,
        statusAfter: status
      }
    });

    return this.findForOrganization(transaction, organizationId, studentId);
  }

  async replaceUnits(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    studentId: string,
    input: ReplaceStudentUnitsInput,
    actorUserId: string,
    correlationId: string
  ): Promise<Student> {
    const currentStudent = await this.findForOrganization(transaction, organizationId, studentId);
    const unitIds = uniqueIds(input.unitIds);
    await this.assertStudentUnitPolicy(transaction, organizationId, unitIds);

    const currentUnitIds = new Set(currentStudent.units.map((unit) => unit.id));
    const nextUnitIds = new Set(unitIds);
    const linkedUnitIds = unitIds.filter((unitId) => !currentUnitIds.has(unitId));
    const unlinkedUnitIds = [...currentUnitIds].filter((unitId) => !nextUnitIds.has(unitId));

    if (linkedUnitIds.length === 0 && unlinkedUnitIds.length === 0) {
      return currentStudent;
    }

    if (unlinkedUnitIds.length > 0) {
      await transaction.studentUnit.updateMany({
        where: {
          organizationId,
          studentId,
          unitId: {
            in: unlinkedUnitIds
          },
          deletedAt: null
        },
        data: {
          deletedAt: new Date()
        }
      });
    }

    if (linkedUnitIds.length > 0) {
      await transaction.studentUnit.createMany({
        data: linkedUnitIds.map((unitId) => ({
          organizationId,
          studentId,
          unitId
        }))
      });
    }

    for (const unitId of linkedUnitIds) {
      await this.recordUnitAudit(
        transaction,
        organizationId,
        studentId,
        unitId,
        "student.unit_linked",
        actorUserId,
        correlationId
      );
    }
    for (const unitId of unlinkedUnitIds) {
      await this.recordUnitAudit(
        transaction,
        organizationId,
        studentId,
        unitId,
        "student.unit_unlinked",
        actorUserId,
        correlationId
      );
    }

    return this.findForOrganization(transaction, organizationId, studentId);
  }

  async listHistory(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    studentId: string,
    unitId?: string
  ): Promise<StudentAuditEvent[]> {
    await this.findForOrganization(transaction, organizationId, studentId, unitId);

    const events = await transaction.auditLog.findMany({
      where: {
        organizationId,
        entity: "Student",
        entityId: studentId,
        action: {
          in: [...studentAuditActions]
        }
      },
      select: {
        id: true,
        action: true,
        occurredAt: true,
        metadata: true
      },
      orderBy: {
        occurredAt: "desc"
      },
      take: 100
    });

    return events.flatMap((event) => {
      if (!isStudentAuditAction(event.action)) {
        return [];
      }

      return [
        {
          id: event.id,
          action: event.action,
          occurredAt: event.occurredAt.toISOString(),
          metadata: sanitizeStudentAuditMetadata(event.action, event.metadata)
        }
      ];
    });
  }

  private async findForOrganization(
    client: PrismaClientLike,
    organizationId: string,
    studentId: string,
    unitId?: string
  ): Promise<Student> {
    const student = await client.student.findFirst({
      where: buildStudentAccessWhere(organizationId, studentId, unitId),
      include: buildStudentInclude(unitId)
    });

    if (!student) {
      throw new DomainError("Student not found for scope.", "STUDENT_NOT_FOUND", 404);
    }

    return toStudent(student);
  }

  private async assertOrganizationExists(
    client: PrismaClientLike,
    organizationId: string
  ): Promise<void> {
    const organization = await client.organization.findFirst({
      where: {
        id: organizationId,
        deletedAt: null
      },
      select: {
        id: true
      }
    });

    if (!organization) {
      throw new DomainError("Organization not found.", "ORGANIZATION_NOT_FOUND", 404);
    }
  }

  private async assertUserExists(
    client: PrismaClientLike,
    userId: string | null | undefined
  ): Promise<void> {
    if (!userId) {
      return;
    }

    const user = await client.user.findFirst({
      where: {
        id: userId,
        deletedAt: null
      },
      select: {
        id: true
      }
    });

    if (!user) {
      throw new DomainError("Student user not found.", "STUDENT_USER_NOT_FOUND", 400);
    }
  }

  private async assertStudentUnitPolicy(
    client: PrismaClientLike,
    organizationId: string,
    unitIds: string[]
  ): Promise<void> {
    const [organization, units] = await Promise.all([
      client.organization.findFirst({
        where: {
          id: organizationId,
          deletedAt: null
        },
        select: {
          type: true
        }
      }),
      client.unit.findMany({
        where: {
          organizationId,
          id: {
            in: unitIds
          },
          deletedAt: null
        },
        select: {
          id: true,
          code: true
        }
      })
    ]);

    if (!organization) {
      throw new DomainError("Organization not found.", "ORGANIZATION_NOT_FOUND", 404);
    }

    if (units.length !== unitIds.length) {
      throw new DomainError(
        "One or more units do not belong to organization.",
        "UNIT_NOT_FOUND",
        404
      );
    }

    assertUnitCountForOrganizationType(organization.type, units);
  }

  private recordUnitAudit(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    studentId: string,
    unitId: string,
    action: "student.unit_linked" | "student.unit_unlinked",
    actorUserId: string,
    correlationId: string
  ): Promise<void> {
    return this.auditService.record(transaction, {
      organizationId,
      unitId,
      actorUserId,
      action,
      entity: "Student",
      entityId: studentId,
      correlationId,
      metadata: {
        unitId
      }
    });
  }
}

function buildStudentInclude(unitId?: string) {
  return {
    unitLinks: {
      where: {
        deletedAt: null,
        ...(unitId ? { unitId } : {})
      },
      include: studentUnitInclude,
      orderBy: {
        unit: {
          name: "asc" as const
        }
      }
    }
  } satisfies Prisma.StudentInclude;
}

function buildStudentAccessWhere(
  organizationId: string,
  studentId: string,
  unitId?: string
): Prisma.StudentWhereInput {
  return {
    id: studentId,
    organizationId,
    deletedAt: null,
    ...(unitId
      ? {
          unitLinks: {
            some: {
              organizationId,
              unitId,
              deletedAt: null
            }
          }
        }
      : {})
  };
}

function buildStudentWhere(
  organizationId: string,
  query: ListStudentsQueryInput,
  unitId?: string
): Prisma.StudentWhereInput {
  const effectiveUnitId = unitId ?? query.unitId;
  const where: Prisma.StudentWhereInput = {
    organizationId,
    deletedAt: null,
    ...(effectiveUnitId
      ? {
          unitLinks: {
            some: {
              organizationId,
              unitId: effectiveUnitId,
              deletedAt: null
            }
          }
        }
      : {})
  };

  if (query.status) {
    where.status = query.status;
  }

  if (query.search) {
    where.OR = ["name", "socialName", "email", "phone"].map((field) => ({
      [field]: {
        contains: query.search,
        mode: "insensitive"
      }
    })) as Prisma.StudentWhereInput[];
  }

  return where;
}

function buildStudentOrderBy(
  query: ListStudentsQueryInput
): Prisma.StudentOrderByWithRelationInput[] {
  const primary = {
    [query.sortBy]: query.sortDirection
  } as Prisma.StudentOrderByWithRelationInput;

  return [primary, ...(query.sortBy === "name" ? [] : [{ name: "asc" as const }]), { id: "asc" }];
}

function buildStudentUpdateData(
  input: UpdateStudentInput,
  currentStudent: Student
): Prisma.StudentUpdateInput {
  const data: Prisma.StudentUpdateInput = {};

  if (input.userId !== undefined && input.userId !== currentStudent.userId) {
    data.user = input.userId
      ? {
          connect: {
            id: input.userId
          }
        }
      : {
          disconnect: true
        };
  }

  if (input.name !== undefined && input.name !== currentStudent.name) {
    data.name = input.name;
  }

  if (input.socialName !== undefined && input.socialName !== currentStudent.socialName) {
    data.socialName = input.socialName;
  }

  if (input.email !== undefined && input.email !== currentStudent.email) {
    data.email = input.email;
  }

  if (input.phone !== undefined && input.phone !== currentStudent.phone) {
    data.phone = input.phone;
  }

  if (input.birthDate !== undefined && input.birthDate !== currentStudent.birthDate) {
    data.birthDate = input.birthDate === null ? null : toBirthDate(input.birthDate);
  }

  if (
    input.operationalNote !== undefined &&
    input.operationalNote !== currentStudent.operationalNote
  ) {
    data.operationalNote = input.operationalNote;
  }

  return data;
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function toBirthDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toStudent(student: StudentWithUnits): Student {
  return {
    id: student.id,
    organizationId: student.organizationId,
    userId: student.userId,
    name: student.name,
    socialName: student.socialName,
    email: student.email,
    phone: student.phone,
    birthDate: student.birthDate ? student.birthDate.toISOString().slice(0, 10) : null,
    operationalNote: student.operationalNote,
    status: student.status,
    createdAt: student.createdAt.toISOString(),
    updatedAt: student.updatedAt.toISOString(),
    units: student.unitLinks.map((link) => ({
      id: link.unit.id,
      name: link.unit.name,
      code: link.unit.code
    }))
  };
}

function assertUnitCountForOrganizationType(
  organizationType: AccountOrganizationType,
  units: Array<{ id: string; code: string | null }>
): void {
  if (organizationType === "PERSONAL") {
    if (units.length !== 1 || units[0]?.code !== "MAIN") {
      throw new DomainError(
        "Personal organizations require the main unit.",
        "STUDENT_UNIT_POLICY_VIOLATION",
        400
      );
    }
    return;
  }

  if (organizationType === "GYM" && units.length !== 1) {
    throw new DomainError(
      "Gym organizations require exactly one operational unit.",
      "STUDENT_UNIT_POLICY_VIOLATION",
      400
    );
  }

  if (organizationType === "NETWORK" && units.length < 1) {
    throw new DomainError(
      "Network organizations require at least one unit.",
      "STUDENT_UNIT_POLICY_VIOLATION",
      400
    );
  }
}

const studentAuditActions = [
  "student.created",
  "student.updated",
  "student.inactivated",
  "student.reactivated",
  "student.unit_linked",
  "student.unit_unlinked"
] as const satisfies readonly StudentAuditAction[];

function isStudentAuditAction(action: string): action is StudentAuditAction {
  return (studentAuditActions as readonly string[]).includes(action);
}

function sanitizeStudentAuditMetadata(
  action: StudentAuditAction,
  metadata: unknown
): StudentAuditMetadata {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  const value = metadata as Record<string, unknown>;
  if (action === "student.created") {
    const statusAfter = readStudentStatus(value.statusAfter);
    const unitIds = readStringArray(value.unitIds);
    return {
      ...(statusAfter ? { statusAfter } : {}),
      ...(unitIds ? { unitIds } : {})
    };
  }

  if (action === "student.updated") {
    const changedFields = readStringArray(value.changedFields);
    return changedFields ? { changedFields } : {};
  }

  if (action === "student.inactivated" || action === "student.reactivated") {
    const statusBefore = readStudentStatus(value.statusBefore);
    const statusAfter = readStudentStatus(value.statusAfter);
    return {
      ...(statusBefore ? { statusBefore } : {}),
      ...(statusAfter ? { statusAfter } : {})
    };
  }

  return typeof value.unitId === "string" ? { unitId: value.unitId } : {};
}

function readStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : undefined;
}

function readStudentStatus(value: unknown): StudentStatus | undefined {
  return value === "ACTIVE" || value === "INACTIVE" ? value : undefined;
}
