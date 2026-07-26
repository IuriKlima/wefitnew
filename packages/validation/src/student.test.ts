import { describe, expect, it } from "vitest";

import { createStudentSchema, listStudentsQuerySchema, updateStudentSchema } from "./student.js";

describe("student validation", () => {
  it("accepts the minimal non-sensitive student payload", () => {
    const input = createStudentSchema.parse({
      organizationId: "11111111-1111-4111-8111-111111111111",
      name: "Ana Martins"
    });

    expect(input.status).toBe("ACTIVE");
    expect(input.unitIds).toEqual([]);
  });

  it("normalizes empty optional contact fields to null", () => {
    const input = createStudentSchema.parse({
      organizationId: "11111111-1111-4111-8111-111111111111",
      name: "Ana Martins",
      socialName: "",
      email: "",
      phone: "",
      operationalNote: ""
    });

    expect(input.socialName).toBeNull();
    expect(input.email).toBeNull();
    expect(input.phone).toBeNull();
    expect(input.operationalNote).toBeNull();
  });

  it("rejects empty updates", () => {
    expect(() => updateStudentSchema.parse({})).toThrow();
  });

  it("rejects invalid and future birth dates", () => {
    const organizationId = "11111111-1111-4111-8111-111111111111";

    expect(() =>
      createStudentSchema.parse({ organizationId, name: "Ana", birthDate: "2026-02-31" })
    ).toThrow();
    expect(() =>
      createStudentSchema.parse({ organizationId, name: "Ana", birthDate: "2999-01-01" })
    ).toThrow();
  });

  it("normalizes e-mail and bounds list pagination and sorting", () => {
    const input = createStudentSchema.parse({
      organizationId: "11111111-1111-4111-8111-111111111111",
      name: " Ana Martins ",
      email: " ANA@EXAMPLE.TEST "
    });
    const query = listStudentsQuerySchema.parse({
      page: "2",
      pageSize: "100",
      sortBy: "updatedAt",
      sortDirection: "desc"
    });

    expect(input.name).toBe("Ana Martins");
    expect(input.email).toBe("ana@example.test");
    expect(query).toMatchObject({
      page: 2,
      pageSize: 100,
      sortBy: "updatedAt",
      sortDirection: "desc"
    });
    expect(() => listStudentsQuerySchema.parse({ pageSize: "101" })).toThrow();
  });
});
