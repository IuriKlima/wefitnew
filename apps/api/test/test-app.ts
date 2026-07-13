import { Test } from "@nestjs/testing";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";

import { loadApiEnv } from "@gym-platform/config";

import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/setup-app.js";
import { configureUnitTestEnv } from "./test-env.js";

export async function createTestApp(): Promise<NestFastifyApplication> {
  configureUnitTestEnv();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule]
  }).compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({
      logger: false
    })
  );

  await configureApp(app, loadApiEnv());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return app;
}
