import { describe, expect, it } from "vitest";

import { parseRedisConnection } from "./redis-connection.js";

describe("Redis connection URL", () => {
  it("supports authenticated TLS connections", () => {
    expect(
      parseRedisConnection("rediss://worker%40tenant:secret%2Fvalue@redis.example.com:6380/2")
    ).toEqual({
      host: "redis.example.com",
      port: 6380,
      username: "worker@tenant",
      password: "secret/value",
      db: 2,
      tls: {}
    });
  });

  it("keeps local plaintext connections compatible", () => {
    expect(parseRedisConnection("redis://localhost:6379")).toEqual({
      host: "localhost",
      port: 6379
    });
  });

  it.each(["http://redis.example.com", "redis://redis.example.com/not-a-database"])(
    "rejects an invalid Redis URL: %s",
    (value) => {
      expect(() => parseRedisConnection(value)).toThrow();
    }
  );
});
