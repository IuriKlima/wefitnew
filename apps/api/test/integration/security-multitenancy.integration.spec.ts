import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { permissionKeys } from "@gym-platform/permissions";

import { SubscriptionsService } from "../../src/modules/subscriptions/subscriptions.service.js";
import { createTestApp } from "../test-app.js";
import {
  assertDatabaseAvailable,
  createTestPrismaClient,
  resetDatabase
} from "../test-database.js";
import { configureIntegrationTestEnv } from "../test-env.js";

const uuidSchema = z.string().uuid();
const ownerUserId = "11111111-1111-4111-8111-111111111111";
const secondUserId = "22222222-2222-4222-8222-222222222222";
const limitedUserId = "33333333-3333-4333-8333-333333333333";

configureIntegrationTestEnv();

const createdOrganizationSchema = z.object({
  organization: z.object({
    id: uuidSchema,
    type: z.enum(["PERSONAL", "GYM", "NETWORK"]),
    legalName: z.string(),
    tradeName: z.string().nullable(),
    slug: z.string()
  }),
  defaultUnit: z.object({
    id: uuidSchema,
    organizationId: uuidSchema,
    name: z.string(),
    code: z.string().nullable()
  })
});

const unitSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  name: z.string(),
  code: z.string().nullable(),
  timezone: z.string()
});

const studentSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  name: z.string(),
  socialName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  birthDate: z.string().nullable(),
  operationalNote: z.string().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  units: z.array(
    z.object({
      id: uuidSchema,
      name: z.string(),
      code: z.string().nullable()
    })
  )
});

const paginatedStudentsSchema = z.object({
  data: z.array(studentSchema),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
    totalPages: z.number()
  })
});

describe("security and multi-tenancy integration", () => {
  const prisma = createTestPrismaClient();
  const subscriptionsService = new SubscriptionsService(prisma);
  let app: NestFastifyApplication;

  beforeAll(async () => {
    await assertDatabaseAvailable(prisma);
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await seedUser(ownerUserId, "owner@example.test");
    await seedUser(secondUserId, "second@example.test");
    await seedUser(limitedUserId, "limited@example.test");
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await prisma.$disconnect();
    await app.close();
  });

  it("returns readiness when PostgreSQL is available", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health/ready"
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload).dependencies.postgres).toBe("ok");
  });

  it("returns 403 for an authenticated user without membership", async () => {
    const organization = await createOrganization(ownerUserId, "org-owner-only");

    const response = await app.inject({
      method: "GET",
      url: `/organizations/${organization.organization.id}/units/${organization.defaultUnit.id}`,
      headers: authHeaders(secondUserId)
    });

    expect(response.statusCode).toBe(403);
  });

  it("prevents a user from Organization A reading a unit from Organization B", async () => {
    const orgA = await createOrganization(ownerUserId, "tenant-a");
    const orgB = await createOrganization(secondUserId, "tenant-b");

    const response = await app.inject({
      method: "GET",
      url: `/organizations/${orgB.organization.id}/units/${orgB.defaultUnit.id}`,
      headers: authHeaders(ownerUserId)
    });

    expect(orgA.organization.id).not.toBe(orgB.organization.id);
    expect(response.statusCode).toBe(403);
  });

  it("allows an owner to create a unit", async () => {
    const organization = await createOrganization(ownerUserId, "owner-create-unit");

    const response = await app.inject({
      method: "POST",
      url: `/organizations/${organization.organization.id}/units`,
      headers: authHeaders(ownerUserId),
      payload: {
        name: "Unidade Norte",
        code: "NORTH"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(unitSchema.parse(JSON.parse(response.payload)).code).toBe("NORTH");
  });

  it("does not allow a unit-scoped unit:manage grant to create a unit", async () => {
    const organization = await createOrganization(ownerUserId, "scoped-unit-create");
    await assignScopedStudentManager(
      organization.organization.id,
      organization.defaultUnit.id,
      limitedUserId
    );

    const response = await app.inject({
      method: "POST",
      url: `/organizations/${organization.organization.id}/units`,
      headers: authHeaders(limitedUserId, organization.defaultUnit.id),
      payload: {
        name: "Unidade indevida",
        code: "DENIED"
      }
    });

    expect(response.statusCode).toBe(403);
    expect(
      await prisma.unit.count({ where: { organizationId: organization.organization.id } })
    ).toBe(1);
  });

  it("does not allow a role scoped to Unit A to read Unit B", async () => {
    const organization = await createOrganization(ownerUserId, "unit-scope");
    const unitB = await createUnit(organization.organization.id, ownerUserId, "UNIT_B");
    await assignLimitedReader(
      organization.organization.id,
      organization.defaultUnit.id,
      limitedUserId
    );

    const allowedResponse = await app.inject({
      method: "GET",
      url: `/organizations/${organization.organization.id}/units/${organization.defaultUnit.id}`,
      headers: authHeaders(limitedUserId)
    });
    expect(allowedResponse.statusCode).toBe(200);

    const deniedResponse = await app.inject({
      method: "GET",
      url: `/organizations/${organization.organization.id}/units/${unitB.id}`,
      headers: authHeaders(limitedUserId)
    });
    expect(deniedResponse.statusCode).toBe(403);
  });

  it("limits unit and student reads to the active unit context", async () => {
    const organization = await createOrganization(ownerUserId, "student-unit-read-scope");
    const unitB = await createUnit(organization.organization.id, ownerUserId, "UNIT_B");
    const studentA = await createStudent(
      organization.organization.id,
      ownerUserId,
      "Aluno Unidade A",
      [organization.defaultUnit.id]
    );
    const studentB = await createStudent(
      organization.organization.id,
      ownerUserId,
      "Aluno Unidade B",
      [unitB.id]
    );
    await assignScopedStudentManager(
      organization.organization.id,
      organization.defaultUnit.id,
      limitedUserId
    );

    const headers = authHeaders(limitedUserId, organization.defaultUnit.id);
    const unitsResponse = await app.inject({
      method: "GET",
      url: `/organizations/${organization.organization.id}/units`,
      headers
    });
    expect(unitsResponse.statusCode).toBe(200);
    expect(
      z
        .array(unitSchema.pick({ id: true, name: true, code: true }))
        .parse(JSON.parse(unitsResponse.payload))
    ).toEqual([expect.objectContaining({ id: organization.defaultUnit.id })]);

    const listResponse = await app.inject({
      method: "GET",
      url: `/organizations/${organization.organization.id}/students`,
      headers
    });
    expect(listResponse.statusCode).toBe(200);
    const students = paginatedStudentsSchema.parse(JSON.parse(listResponse.payload));
    expect(students.data.map((student) => student.id)).toEqual([studentA.id]);
    expect(students.data[0]?.units.map((unit) => unit.id)).toEqual([organization.defaultUnit.id]);

    const allowedResponse = await app.inject({
      method: "GET",
      url: `/organizations/${organization.organization.id}/students/${studentA.id}`,
      headers
    });
    expect(allowedResponse.statusCode).toBe(200);

    const deniedResponse = await app.inject({
      method: "GET",
      url: `/organizations/${organization.organization.id}/students/${studentB.id}`,
      headers
    });
    expect(deniedResponse.statusCode).toBe(404);
  });

  it("prevents a unit-scoped user from mutating or archiving a shared student", async () => {
    const organization = await createOrganization(ownerUserId, "student-unit-write-scope");
    const unitB = await createUnit(organization.organization.id, ownerUserId, "UNIT_B");
    const sharedStudent = await createStudent(
      organization.organization.id,
      ownerUserId,
      "Aluno Compartilhado",
      [organization.defaultUnit.id, unitB.id]
    );
    await assignScopedStudentManager(
      organization.organization.id,
      organization.defaultUnit.id,
      limitedUserId
    );
    const headers = authHeaders(limitedUserId, organization.defaultUnit.id);

    const readResponse = await app.inject({
      method: "GET",
      url: `/organizations/${organization.organization.id}/students/${sharedStudent.id}`,
      headers
    });
    expect(readResponse.statusCode).toBe(200);
    expect(
      studentSchema.parse(JSON.parse(readResponse.payload)).units.map((unit) => unit.id)
    ).toEqual([organization.defaultUnit.id]);

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/organizations/${organization.organization.id}/students/${sharedStudent.id}`,
      headers,
      payload: {
        name: "Alteracao indevida",
        status: "INACTIVE"
      }
    });
    expect(updateResponse.statusCode).toBe(403);

    const archiveResponse = await app.inject({
      method: "DELETE",
      url: `/organizations/${organization.organization.id}/students/${sharedStudent.id}`,
      headers
    });
    expect(archiveResponse.statusCode).toBe(403);

    const createForOtherUnitResponse = await app.inject({
      method: "POST",
      url: `/organizations/${organization.organization.id}/students`,
      headers,
      payload: {
        name: "Criacao fora do escopo",
        unitIds: [unitB.id]
      }
    });
    expect(createForOtherUnitResponse.statusCode).toBe(403);

    const replaceUnitsResponse = await app.inject({
      method: "PATCH",
      url: `/organizations/${organization.organization.id}/students/${sharedStudent.id}`,
      headers,
      payload: {
        unitIds: [organization.defaultUnit.id]
      }
    });
    expect(replaceUnitsResponse.statusCode).toBe(403);

    const persistedStudent = await prisma.student.findUniqueOrThrow({
      where: { id: sharedStudent.id }
    });
    expect(persistedStudent.name).toBe("Aluno Compartilhado");
    expect(persistedStudent.status).toBe("ACTIVE");
    expect(persistedStudent.deletedAt).toBeNull();

    const activeLinks = await prisma.studentUnit.findMany({
      where: {
        organizationId: organization.organization.id,
        studentId: sharedStudent.id,
        deletedAt: null
      },
      orderBy: { unitId: "asc" }
    });
    expect(activeLinks.map((link) => link.unitId)).toEqual(
      [organization.defaultUnit.id, unitB.id].sort()
    );
  });

  it("requires a global grant to create a student even with a unit context", async () => {
    const organization = await createOrganization(ownerUserId, "student-unit-create-default");
    await assignScopedStudentManager(
      organization.organization.id,
      organization.defaultUnit.id,
      limitedUserId
    );

    const response = await app.inject({
      method: "POST",
      url: `/organizations/${organization.organization.id}/students`,
      headers: authHeaders(limitedUserId, organization.defaultUnit.id),
      payload: {
        name: "Aluno da unidade atual"
      }
    });

    expect(response.statusCode).toBe(403);
    expect(
      await prisma.student.count({ where: { organizationId: organization.organization.id } })
    ).toBe(0);
  });

  it("keeps inactive students searchable and lets a global owner archive them", async () => {
    const organization = await createOrganization(ownerUserId, "students-crud");
    const student = await createStudent(organization.organization.id, ownerUserId, "Ana Martins", [
      organization.defaultUnit.id
    ]);

    expect(student.units).toHaveLength(1);

    const listResponse = await app.inject({
      method: "GET",
      url: `/organizations/${organization.organization.id}/students?search=ana&status=ACTIVE`,
      headers: authHeaders(ownerUserId)
    });
    expect(listResponse.statusCode).toBe(200);
    expect(paginatedStudentsSchema.parse(JSON.parse(listResponse.payload)).pagination.total).toBe(
      1
    );

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/organizations/${organization.organization.id}/students/${student.id}`,
      headers: authHeaders(ownerUserId, organization.defaultUnit.id),
      payload: {
        name: "Ana Martins Silva",
        email: "ana@example.test",
        status: "ACTIVE"
      }
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(studentSchema.parse(JSON.parse(updateResponse.payload)).email).toBe("ana@example.test");

    const inactivateResponse = await app.inject({
      method: "PATCH",
      url: `/organizations/${organization.organization.id}/students/${student.id}`,
      headers: authHeaders(ownerUserId, organization.defaultUnit.id),
      payload: {
        status: "INACTIVE"
      }
    });
    expect(inactivateResponse.statusCode).toBe(200);
    expect(studentSchema.parse(JSON.parse(inactivateResponse.payload)).status).toBe("INACTIVE");

    const inactiveListResponse = await app.inject({
      method: "GET",
      url: `/organizations/${organization.organization.id}/students?status=INACTIVE`,
      headers: authHeaders(ownerUserId)
    });
    expect(inactiveListResponse.statusCode).toBe(200);
    expect(
      paginatedStudentsSchema
        .parse(JSON.parse(inactiveListResponse.payload))
        .data.map((listedStudent) => listedStudent.id)
    ).toContain(student.id);

    const inactiveStudent = await prisma.student.findUniqueOrThrow({ where: { id: student.id } });
    expect(inactiveStudent.deletedAt).toBeNull();
    expect(
      await prisma.studentUnit.count({
        where: { studentId: student.id, deletedAt: null }
      })
    ).toBe(1);

    const archiveResponse = await app.inject({
      method: "DELETE",
      url: `/organizations/${organization.organization.id}/students/${student.id}`,
      headers: authHeaders(ownerUserId, organization.defaultUnit.id)
    });
    expect(archiveResponse.statusCode).toBe(200);
    expect(studentSchema.parse(JSON.parse(archiveResponse.payload)).status).toBe("INACTIVE");

    const getDeletedResponse = await app.inject({
      method: "GET",
      url: `/organizations/${organization.organization.id}/students/${student.id}`,
      headers: authHeaders(ownerUserId)
    });
    expect(getDeletedResponse.statusCode).toBe(404);

    const auditCount = await prisma.auditLog.count({
      where: {
        organizationId: organization.organization.id,
        entity: "Student"
      }
    });
    expect(auditCount).toBe(4);
  });

  it("enforces RBAC for student management", async () => {
    const organization = await createOrganization(ownerUserId, "students-rbac");
    await assignStudentReader(organization.organization.id, limitedUserId);

    const listResponse = await app.inject({
      method: "GET",
      url: `/organizations/${organization.organization.id}/students`,
      headers: authHeaders(limitedUserId)
    });
    expect(listResponse.statusCode).toBe(200);

    const createResponse = await app.inject({
      method: "POST",
      url: `/organizations/${organization.organization.id}/students`,
      headers: authHeaders(limitedUserId),
      payload: {
        name: "Sem permissao"
      }
    });
    expect(createResponse.statusCode).toBe(403);
  });

  it("prevents a user from Organization A reading a student from Organization B", async () => {
    await createOrganization(ownerUserId, "student-tenant-a");
    const orgB = await createOrganization(secondUserId, "student-tenant-b");
    const studentB = await createStudent(orgB.organization.id, secondUserId, "Aluno B", [
      orgB.defaultUnit.id
    ]);

    const response = await app.inject({
      method: "GET",
      url: `/organizations/${orgB.organization.id}/students/${studentB.id}`,
      headers: authHeaders(ownerUserId)
    });

    expect(response.statusCode).toBe(403);
  });

  it("rejects cross-tenant student unit combinations in PostgreSQL", async () => {
    const orgA = await createOrganization(ownerUserId, "student-constraint-a");
    const orgB = await createOrganization(secondUserId, "student-constraint-b");
    const studentA = await createStudent(orgA.organization.id, ownerUserId, "Aluno A", [
      orgA.defaultUnit.id
    ]);

    await expect(
      prisma.studentUnit.create({
        data: {
          organizationId: orgA.organization.id,
          studentId: studentA.id,
          unitId: orgB.defaultUnit.id
        }
      })
    ).rejects.toThrow();
  });

  it("rejects cross-tenant membership role combinations in PostgreSQL", async () => {
    const orgA = await createOrganization(ownerUserId, "constraint-a");
    const orgB = await createOrganization(secondUserId, "constraint-b");
    const membershipA = await prisma.membership.findFirstOrThrow({
      where: {
        organizationId: orgA.organization.id,
        userId: ownerUserId
      }
    });
    const roleB = await prisma.role.findFirstOrThrow({
      where: {
        organizationId: orgB.organization.id,
        key: "owner"
      }
    });

    await expect(
      prisma.membershipRole.create({
        data: {
          organizationId: orgA.organization.id,
          membershipId: membershipA.id,
          roleId: roleB.id
        }
      })
    ).rejects.toThrow();
  });

  it("rejects audit logs with a unit from another organization", async () => {
    const orgA = await createOrganization(ownerUserId, "audit-a");
    const orgB = await createOrganization(secondUserId, "audit-b");

    await expect(
      prisma.auditLog.create({
        data: {
          organizationId: orgA.organization.id,
          unitId: orgB.defaultUnit.id,
          action: "invalid.audit",
          entity: "Unit"
        }
      })
    ).rejects.toThrow();
  });

  it("rejects duplicated membership role assignment", async () => {
    const organization = await createOrganization(ownerUserId, "duplicate-assignment");
    const membership = await prisma.membership.findFirstOrThrow({
      where: {
        organizationId: organization.organization.id,
        userId: ownerUserId
      }
    });
    const role = await prisma.role.findFirstOrThrow({
      where: {
        organizationId: organization.organization.id,
        key: "owner"
      }
    });

    await expect(
      prisma.membershipRole.create({
        data: {
          organizationId: organization.organization.id,
          membershipId: membership.id,
          roleId: role.id
        }
      })
    ).rejects.toThrow();
  });

  it("resolves subscription feature states by time and status", async () => {
    const organization = await createOrganization(ownerUserId, "subscription-states");
    const { plan, feature } = await createPlanFeature("units.manage", true, 3);

    await createSubscription(organization.organization.id, plan.id, "ACTIVE", daysFromNow(1), null);
    await expectFeature(organization.organization.id, "units.manage", false, null);

    await prisma.organizationSubscription.deleteMany();
    await createSubscription(
      organization.organization.id,
      plan.id,
      "ACTIVE",
      daysFromNow(-10),
      daysFromNow(-1)
    );
    await expectFeature(organization.organization.id, "units.manage", false, null);

    await prisma.organizationSubscription.deleteMany();
    await createSubscription(
      organization.organization.id,
      plan.id,
      "SUSPENDED",
      daysFromNow(-1),
      null
    );
    await expectFeature(organization.organization.id, "units.manage", false, null);

    await prisma.organizationSubscription.deleteMany();
    await createSubscription(
      organization.organization.id,
      plan.id,
      "ACTIVE",
      daysFromNow(-1),
      null
    );
    const active = await subscriptionsService.resolveFeature(
      organization.organization.id,
      feature.key
    );
    expect(active.enabled).toBe(true);
    expect(active.limitValue).toBe(3);
    await expectFeature(organization.organization.id, "unknown.feature", false, null);
  });

  it("rejects overlapping open effective subscriptions", async () => {
    const organization = await createOrganization(ownerUserId, "subscription-overlap");
    const { plan } = await createPlanFeature("units.manage", true, null);

    await createSubscription(
      organization.organization.id,
      plan.id,
      "ACTIVE",
      daysFromNow(-1),
      null
    );

    await expect(
      createSubscription(organization.organization.id, plan.id, "TRIALING", daysFromNow(-1), null)
    ).rejects.toThrow();
  });

  it("rejects overlapping closed effective subscriptions", async () => {
    const organization = await createOrganization(ownerUserId, "subscription-closed-overlap");
    const { plan } = await createPlanFeature("students.manage", true, null);
    const startsAt = new Date("2026-01-01T00:00:00.000Z");
    const endsAt = new Date("2026-02-01T00:00:00.000Z");

    await createSubscription(organization.organization.id, plan.id, "ACTIVE", startsAt, endsAt);

    await expect(
      createSubscription(
        organization.organization.id,
        plan.id,
        "TRIALING",
        new Date("2026-01-15T00:00:00.000Z"),
        new Date("2026-03-01T00:00:00.000Z")
      )
    ).rejects.toThrow();

    await expect(
      createSubscription(
        organization.organization.id,
        plan.id,
        "ACTIVE",
        endsAt,
        new Date("2026-03-01T00:00:00.000Z")
      )
    ).resolves.toBeDefined();
  });

  async function seedUser(id: string, email: string) {
    await prisma.user.create({
      data: {
        id,
        name: email,
        email
      }
    });
  }

  async function createOrganization(userId: string, slug: string) {
    const response = await app.inject({
      method: "POST",
      url: "/organizations",
      headers: authHeaders(userId),
      payload: {
        type: "GYM",
        legalName: slug,
        slug
      }
    });

    expect(response.statusCode).toBe(201);
    return createdOrganizationSchema.parse(JSON.parse(response.payload));
  }

  async function createUnit(organizationId: string, userId: string, code: string) {
    const response = await app.inject({
      method: "POST",
      url: `/organizations/${organizationId}/units`,
      headers: authHeaders(userId),
      payload: {
        name: code,
        code
      }
    });

    expect(response.statusCode).toBe(201);
    return unitSchema.parse(JSON.parse(response.payload));
  }

  async function createStudent(
    organizationId: string,
    userId: string,
    name: string,
    unitIds: string[] = []
  ) {
    const response = await app.inject({
      method: "POST",
      url: `/organizations/${organizationId}/students`,
      headers: authHeaders(userId),
      payload: {
        name,
        email: `${name.toLowerCase().replaceAll(" ", ".")}@example.test`,
        phone: "11999999999",
        birthDate: "1990-01-01",
        operationalNote: "Observacao operacional",
        unitIds
      }
    });

    expect(response.statusCode).toBe(201);
    return studentSchema.parse(JSON.parse(response.payload));
  }

  async function assignLimitedReader(organizationId: string, unitId: string, userId: string) {
    const permission = await prisma.permission.upsert({
      where: {
        key: permissionKeys.unitRead
      },
      create: {
        key: permissionKeys.unitRead,
        description: "Allows unit read."
      },
      update: {}
    });
    const role = await prisma.role.create({
      data: {
        organizationId,
        key: "unit-reader",
        name: "Unit reader"
      }
    });
    await prisma.rolePermission.create({
      data: {
        roleId: role.id,
        permissionId: permission.id
      }
    });
    const membership = await prisma.membership.create({
      data: {
        organizationId,
        userId,
        status: "ACTIVE"
      }
    });
    await prisma.membershipRole.create({
      data: {
        organizationId,
        membershipId: membership.id,
        roleId: role.id,
        unitId
      }
    });
  }

  async function assignStudentReader(organizationId: string, userId: string) {
    const permission = await prisma.permission.upsert({
      where: {
        key: permissionKeys.studentRead
      },
      create: {
        key: permissionKeys.studentRead,
        description: "Allows student read."
      },
      update: {}
    });
    const role = await prisma.role.create({
      data: {
        organizationId,
        key: "student-reader",
        name: "Student reader"
      }
    });
    await prisma.rolePermission.create({
      data: {
        roleId: role.id,
        permissionId: permission.id
      }
    });
    const membership = await prisma.membership.create({
      data: {
        organizationId,
        userId,
        status: "ACTIVE"
      }
    });
    await prisma.membershipRole.create({
      data: {
        organizationId,
        membershipId: membership.id,
        roleId: role.id,
        unitId: null
      }
    });
  }

  async function assignScopedStudentManager(
    organizationId: string,
    unitId: string,
    userId: string
  ) {
    const permissionKeysForRole = [
      permissionKeys.studentRead,
      permissionKeys.studentManage,
      permissionKeys.unitRead,
      permissionKeys.unitManage
    ];
    const permissions = await Promise.all(
      permissionKeysForRole.map((key) =>
        prisma.permission.upsert({
          where: { key },
          create: {
            key,
            description: `Allows ${key}.`
          },
          update: {}
        })
      )
    );
    const role = await prisma.role.create({
      data: {
        organizationId,
        key: `student-manager-${unitId}`,
        name: "Student manager"
      }
    });
    await prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId: role.id,
        permissionId: permission.id
      }))
    });
    const membership = await prisma.membership.create({
      data: {
        organizationId,
        userId,
        status: "ACTIVE"
      }
    });
    await prisma.membershipRole.create({
      data: {
        organizationId,
        membershipId: membership.id,
        roleId: role.id,
        unitId
      }
    });
  }

  async function createPlanFeature(key: string, enabled: boolean, limitValue: number | null) {
    const plan = await prisma.subscriptionPlan.create({
      data: {
        code: `plan-${key}-${Math.random().toString(36).slice(2)}`,
        name: "Plan"
      }
    });
    const feature = await prisma.feature.create({
      data: {
        key,
        name: key
      }
    });
    await prisma.planFeature.create({
      data: {
        planId: plan.id,
        featureId: feature.id,
        enabled,
        limitValue
      }
    });

    return { plan, feature };
  }

  function createSubscription(
    organizationId: string,
    planId: string,
    status: "TRIALING" | "ACTIVE" | "SUSPENDED" | "CANCELED" | "EXPIRED",
    startsAt: Date,
    endsAt: Date | null
  ) {
    return prisma.organizationSubscription.create({
      data: {
        organizationId,
        planId,
        status,
        startsAt,
        endsAt
      }
    });
  }

  async function expectFeature(
    organizationId: string,
    key: string,
    enabled: boolean,
    limitValue: number | null
  ) {
    const resolved = await subscriptionsService.resolveFeature(organizationId, key);

    expect(resolved.enabled).toBe(enabled);
    expect(resolved.limitValue).toBe(limitValue);
  }
});

function authHeaders(userId: string, unitId?: string) {
  return {
    "x-dev-user-id": userId,
    ...(unitId ? { "x-unit-id": unitId } : {})
  };
}

function daysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}
