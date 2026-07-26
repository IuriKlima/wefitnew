import { describe, expect, it, vi } from "vitest";

import type { Prisma } from "@gym-platform/database";

import { PrismaService } from "./prisma.service.js";

describe("PrismaService context transactions", () => {
  it("uses resilient defaults while preserving caller overrides", async () => {
    const transaction = {
      $executeRaw: vi.fn().mockResolvedValue(1)
    } as unknown as Prisma.TransactionClient;
    const service = Object.create(PrismaService.prototype) as PrismaService;
    const transactionSpy = vi
      .fn()
      .mockImplementation(async (callback: (tx: Prisma.TransactionClient) => Promise<string>) =>
        callback(transaction)
      );

    Object.assign(service, { $transaction: transactionSpy });

    await expect(
      service.withActorContext(
        { actorUserId: "11111111-1111-4111-8111-111111111111" },
        async () => "ok",
        { timeout: 20_000 }
      )
    ).resolves.toBe("ok");

    expect(transactionSpy).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 8_000,
      timeout: 20_000
    });
  });
});
