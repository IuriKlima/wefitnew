import { Test } from "@nestjs/testing";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";

import { loadApiEnv } from "@gym-platform/config";

import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/infrastructure/database/prisma.service.js";
import { createFastifyOptions } from "../src/infrastructure/http/fastify-options.js";
import { configureApp } from "../src/setup-app.js";
import { configureUnitTestEnv } from "./test-env.js";

export async function createTestApp(options?: {
  prismaService?: PrismaService;
}): Promise<NestFastifyApplication> {
  configureUnitTestEnv();

  const testingModule = Test.createTestingModule({
    imports: [AppModule]
  });

  if (options?.prismaService) {
    testingModule.overrideProvider(PrismaService).useValue(options.prismaService);
  }

  const moduleRef = await testingModule.compile();

  const env = loadApiEnv();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(createFastifyOptions(env, false))
  );

  await configureApp(app, env);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return app;
}
