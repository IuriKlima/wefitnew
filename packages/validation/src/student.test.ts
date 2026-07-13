import { describe, expect, it } from "vitest";

import { createStudentSchema, updateStudentSchema } from "./student.js";

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
});
