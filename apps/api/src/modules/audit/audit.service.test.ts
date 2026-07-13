import { describe, expect, it } from "vitest";

import { sanitizeAuditMetadata } from "./audit.service.js";

describe("audit metadata sanitization", () => {
  it("redacts sensitive metadata keys recursively", () => {
    expect(
      sanitizeAuditMetadata({
        token: "secret",
        nested: {
          password: "hidden"
        }
      })
    ).toEqual({
      token: "[REDACTED]",
      nested: {
        password: "[REDACTED]"
      }
    });
  });

  it("rejects metadata above the configured size limit", () => {
    expect(() =>
      sanitizeAuditMetadata({
        large: "x".repeat(9000)
      })
    ).toThrow("Audit metadata is too large.");
  });
});
