import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import Redis, { type RedisOptions } from "ioredis";

import { type ApiEnv, loadApiEnv } from "@gym-platform/config";

export type RedisReadiness = "ok" | "not_required" | "error";
export type RedisClientFactory = (url: string, options: RedisOptions) => Redis;

const defaultRedisClientFactory: RedisClientFactory = (url, options) => new Redis(url, options);

export class ManagedRedisConnection implements OnModuleDestroy {
  private readonly client: Redis | undefined;
  private connectionAttempt: Promise<void> | undefined;

  constructor(
    private readonly env: ApiEnv,
    clientFactory: RedisClientFactory = defaultRedisClientFactory
  ) {
    if (env.RATE_LIMIT_STORE !== "redis") {
      return;
    }

    this.client = clientFactory(env.REDIS_URL!, {
      lazyConnect: true,
      enableOfflineQueue: false,
      connectTimeout: env.REDIS_CONNECT_TIMEOUT_MS,
      maxRetriesPerRequest: 1,
      retryStrategy: (attempt) =>
        attempt <= env.REDIS_MAX_RECONNECT_ATTEMPTS ? Math.min(attempt * 100, 1_000) : null
    });
    this.client.on("error", () => undefined);
  }

  async initialize(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      await this.connectAndPing();
    } catch {
      this.client.disconnect();
      throw new Error("Redis is required but unavailable.");
    }
  }

  async getReadiness(): Promise<RedisReadiness> {
    if (!this.client) {
      return "not_required";
    }

    try {
      await this.connectAndPing();
      return "ok";
    } catch {
      return "error";
    }
  }

  getClient(): Redis | undefined {
    return this.client;
  }

  getRequiredClient(): Redis {
    if (!this.client) {
      throw new Error("Redis client is not configured.");
    }
    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client || this.client.status === "end") {
      return;
    }

    if (this.client.status !== "ready") {
      this.client.disconnect();
      return;
    }

    await withTimeout(this.client.quit(), this.env.REDIS_HEALTH_TIMEOUT_MS).catch(() =>
      this.client?.disconnect()
    );
  }

  private connectAndPing(): Promise<void> {
    if (this.connectionAttempt) {
      return this.connectionAttempt;
    }

    const attempt = this.performConnectionCheck().finally(() => {
      if (this.connectionAttempt === attempt) {
        this.connectionAttempt = undefined;
      }
    });
    this.connectionAttempt = attempt;
    return attempt;
  }

  private async performConnectionCheck(): Promise<void> {
    const client = this.getRequiredClient();

    if (client.status !== "ready") {
      if (!["wait", "end"].includes(client.status)) {
        client.disconnect();
      }
      await withTimeout(client.connect(), this.env.REDIS_CONNECT_TIMEOUT_MS);
    }

    const response = await withTimeout(client.ping(), this.env.REDIS_HEALTH_TIMEOUT_MS);
    if (response !== "PONG") {
      throw new Error("Redis ping failed.");
    }
  }
}

@Injectable()
export class RedisService extends ManagedRedisConnection {
  constructor() {
    super(loadApiEnv());
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("Operation timed out.")), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
