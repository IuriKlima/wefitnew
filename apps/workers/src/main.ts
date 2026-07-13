import { Queue } from "bullmq";

import { loadWorkerEnv } from "@gym-platform/config";

const env = loadWorkerEnv();
const redisUrl = new URL(env.REDIS_URL);
const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379)
};

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
