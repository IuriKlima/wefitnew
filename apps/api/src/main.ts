import "dotenv/config";
import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";

import { loadApiEnv } from "@gym-platform/config";

import { AppModule } from "./app.module.js";
import { configureApp } from "./setup-app.js";

async function bootstrap() {
  const env = loadApiEnv();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: env.NODE_ENV !== "test"
    })
  );

  await configureApp(app, env);
  app.enableShutdownHooks();
  await app.listen(env.PORT, env.API_HOST);
}

bootstrap().catch((error: unknown) => {
  console.error("API failed to start.", error);
  process.exit(1);
});
