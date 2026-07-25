import { describe, expect, it } from "vitest";

import { Prisma } from "@gym-platform/database";

import { readSafeErrorMessage } from "./global-exception.filter.js";

describe("global exception log redaction", () => {
  it("does not copy database constraint details or values into logs", () => {
    const exception = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint "secret_email_key" failed for owner@example.test',
      {
        clientVersion: "test",
        code: "P2002"
      }
    );

    const message = readSafeErrorMessage(exception);

    expect(message).toBe("Database request failed (P2002).");
    expect(message).not.toContain("secret_email_key");
    expect(message).not.toContain("owner@example.test");
  });

  it("does not expose arbitrary unhandled error text", () => {
    expect(readSafeErrorMessage(new Error("token=secret-value"))).toBe(
      "Unhandled application error."
    );
  });
});
