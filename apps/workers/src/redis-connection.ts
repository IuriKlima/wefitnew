export type RedisConnectionOptions = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  tls?: Record<string, never>;
};

export function parseRedisConnection(redisUrlValue: string): RedisConnectionOptions {
  const redisUrl = new URL(redisUrlValue);

  if (redisUrl.protocol !== "redis:" && redisUrl.protocol !== "rediss:") {
    throw new Error("REDIS_URL must use redis:// or rediss://.");
  }

  const port = Number(redisUrl.port || (redisUrl.protocol === "rediss:" ? 6380 : 6379));
  if (!Number.isSafeInteger(port) || port <= 0 || port > 65535) {
    throw new Error("REDIS_URL contains an invalid port.");
  }

  const databasePath = redisUrl.pathname.replace(/^\//, "");
  const database = databasePath ? Number(databasePath) : undefined;
  if (database !== undefined && (!Number.isSafeInteger(database) || database < 0)) {
    throw new Error("REDIS_URL contains an invalid database number.");
  }

  return {
    host: redisUrl.hostname,
    port,
    ...(redisUrl.username ? { username: decodeURIComponent(redisUrl.username) } : {}),
    ...(redisUrl.password ? { password: decodeURIComponent(redisUrl.password) } : {}),
    ...(database !== undefined ? { db: database } : {}),
    ...(redisUrl.protocol === "rediss:" ? { tls: {} } : {})
  };
}
