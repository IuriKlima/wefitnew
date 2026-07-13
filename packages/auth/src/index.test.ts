import { describe, expect, it } from "vitest";

import { TemporaryHeaderAuthAdapter } from "./index.js";

describe("temporary header auth adapter", () => {
  it("resolves a UUID from x-dev-user-id", async () => {
    const adapter = new TemporaryHeaderAuthAdapter();
    const actor = await adapter.resolveActor({
      "x-dev-user-id": "11111111-1111-4111-8111-111111111111"
    });

    expect(actor?.userId).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("rejects invalid actor identifiers", async () => {
    const adapter = new TemporaryHeaderAuthAdapter();

    await expect(
      adapter.resolveActor({
        "x-dev-user-id": "not-a-uuid"
      })
    ).resolves.toBeNull();
  });
});
