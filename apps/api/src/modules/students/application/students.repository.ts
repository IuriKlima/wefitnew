import { Inject, Injectable } from "@nestjs/common";

import type { PaginatedStudents, Student } from "@gym-platform/contracts";
import { Prisma } from "@gym-platform/database";
import type {
  CreateStudentInput,
  ListStudentsQueryInput,
  UpdateStudentInput
} from "@gym-platform/validation";

import { DomainError } from "../../../common/errors/domain-error.js";
import { PrismaService } from "../../../infrastructure/database/prisma.service.js";

type PrismaClientLike = PrismaService | Prisma.TransactionClient;

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
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(
    input: CreateStudentInput,
    actorUserId: string,
    correlationId: string
  ): Promise<Student> {
    return this.prisma.$transaction(async (transaction) => {
      await this.assertOrganizationExists(transaction, input.organizationId);
      await this.assertUserExists(transaction, input.userId);
      const unitIds = uniqueIds(input.unitIds);
      await this.assertUnitsBelongToOrganization(transaction, input.organizationId, unitIds);

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

      await transaction.auditLog.create({
        data: {
          organizationId: input.organizationId,
          unitId: null,
          actorUserId,
          action: "student.created",
          entity: "Student",
          entityId: student.id,
          correlationId,
          metadata: {
            status: input.status,
            unitIds
          }
        }
      });

      return this.findForOrganization(transaction, input.organizationId, student.id);
    });
  }

  async list(
    organizationId: string,
    query: ListStudentsQueryInput,
    unitId?: string
  ): Promise<PaginatedStudents> {
    const where = buildStudentWhere(organizationId, query, unitId);
    const skip = (query.page - 1) * query.pageSize;
    const include = buildStudentInclude(unitId);

    const [total, students] = await this.prisma.$transaction([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
        include,
        orderBy: [
          {
            name: "asc"
          },
          {
            createdAt: "desc"
          }
        ],
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

  async get(organizationId: string, studentId: string, unitId?: string): Promise<Student> {
    return this.findForOrganization(this.prisma, organizationId, studentId, unitId);
  }

  async update(
    organizationId: string,
    studentId: string,
    input: UpdateStudentInput,
    actorUserId: string,
    correlationId: string
  ): Promise<Student> {
    return this.prisma.$transaction(async (transaction) => {
      const currentStudent = await this.findForOrganization(transaction, organizationId, studentId);
      await this.assertUserExists(transaction, input.userId);

      const data = buildStudentUpdateData(input);
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
      }

      if (input.unitIds !== undefined) {
        const unitIds = uniqueIds(input.unitIds);
        await this.assertUnitsBelongToOrganization(transaction, organizationId, unitIds);

        await transaction.studentUnit.updateMany({
          where: {
            organizationId,
            studentId,
            deletedAt: null
          },
          data: {
            deletedAt: new Date()
          }
        });

        if (unitIds.length > 0) {
          await transaction.studentUnit.createMany({
            data: unitIds.map((selectedUnitId) => ({
              organizationId,
              studentId,
              unitId: selectedUnitId
            }))
          });
        }

        changedFields.push("unitIds");
      }

      await transaction.auditLog.create({
        data: {
          organizationId,
          unitId: null,
          actorUserId,
          action: resolveStudentUpdateAction(currentStudent.status, input.status),
          entity: "Student",
          entityId: studentId,
          correlationId,
          metadata: {
            changedFields
          }
        }
      });

      return this.findForOrganization(transaction, organizationId, studentId);
    });
  }

  async archive(
    organizationId: string,
    studentId: string,
    actorUserId: string,
    correlationId: string
  ): Promise<Student> {
    return this.prisma.$transaction(async (transaction) => {
      await this.findForOrganization(transaction, organizationId, studentId);
      const deletedAt = new Date();

      await transaction.student.update({
        where: {
          organizationId_id: {
            organizationId,
            id: studentId
          }
        },
        data: {
          status: "INACTIVE",
          deletedAt
        }
      });

      await transaction.studentUnit.updateMany({
        where: {
          organizationId,
          studentId,
          deletedAt: null
        },
        data: {
          deletedAt
        }
      });

      await transaction.auditLog.create({
        data: {
          organizationId,
          unitId: null,
          actorUserId,
          action: "student.archived",
          entity: "Student",
          entityId: studentId,
          correlationId
        }
      });

      const student = await transaction.student.findUniqueOrThrow({
        where: {
          organizationId_id: {
            organizationId,
            id: studentId
          }
        },
        include: buildStudentInclude()
      });

      return toStudent(student);
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

  private async assertUnitsBelongToOrganization(
    client: PrismaClientLike,
    organizationId: string,
    unitIds: string[]
  ): Promise<void> {
    if (unitIds.length === 0) {
      return;
    }

    const units = await client.unit.findMany({
      where: {
        organizationId,
        id: {
          in: unitIds
        },
        deletedAt: null
      },
      select: {
        id: true
      }
    });

    if (units.length !== unitIds.length) {
      throw new DomainError(
        "One or more units do not belong to organization.",
        "UNIT_NOT_FOUND",
        404
      );
    }
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
  const where: Prisma.StudentWhereInput = {
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

function buildStudentUpdateData(input: UpdateStudentInput): Prisma.StudentUpdateInput {
  const data: Prisma.StudentUpdateInput = {};

  if (input.userId !== undefined) {
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

  if (input.name !== undefined) {
    data.name = input.name;
  }

  if (input.socialName !== undefined) {
    data.socialName = input.socialName;
  }

  if (input.email !== undefined) {
    data.email = input.email;
  }

  if (input.phone !== undefined) {
    data.phone = input.phone;
  }

  if (input.birthDate !== undefined) {
    data.birthDate = input.birthDate === null ? null : toBirthDate(input.birthDate);
  }

  if (input.operationalNote !== undefined) {
    data.operationalNote = input.operationalNote;
  }

  if (input.status !== undefined) {
    data.status = input.status;
  }

  return data;
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function resolveStudentUpdateAction(
  currentStatus: Student["status"],
  nextStatus: UpdateStudentInput["status"]
): string {
  if (nextStatus === "INACTIVE" && currentStatus !== nextStatus) {
    return "student.inactivated";
  }

  if (nextStatus === "ACTIVE" && currentStatus !== nextStatus) {
    return "student.reactivated";
  }

  return "student.updated";
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
