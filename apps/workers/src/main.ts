import { Queue } from "bullmq";

import { loadWorkerEnv } from "@gym-platform/config";

import { parseRedisConnection } from "./redis-connection.js";

const env = loadWorkerEnv();
const connection = parseRedisConnection(env.REDIS_URL);

const healthQueue = new Queue("health", {
  connection
});

async function bootstrap() {
  await healthQueue.waitUntilReady();
  console.log("Workers started with BullMQ health queue ready.");
}

bootstrap().catch(async (error: unknown) => {
  console.error("Workers failed to start.", error);
  process.exit(1);
});

const shutdown = async () => {
  await healthQueue.close();
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});
