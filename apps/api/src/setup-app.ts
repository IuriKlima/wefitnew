import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";

import { type ApiEnv, parseCorsOrigins } from "@gym-platform/config";

import { GlobalExceptionFilter } from "./common/filters/global-exception.filter.js";
import { CorrelationIdInterceptor } from "./common/interceptors/correlation-id.interceptor.js";

export async function configureApp(app: NestFastifyApplication, env: ApiEnv): Promise<void> {
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new CorrelationIdInterceptor());

  await app.register(helmet);
  await app.register(cors, {
    credentials: true,
    origin: parseCorsOrigins(env.CORS_ORIGINS)
  });
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: "1 minute"
  });

  if (env.SWAGGER_ENABLED) {
    const documentConfig = new DocumentBuilder()
      .setTitle("Gym Management Platform API")
      .setDescription("API inicial da plataforma SaaS multi-tenant para academias.")
      .setVersion("0.1.0")
      .build();

    const document = SwaggerModule.createDocument(app, documentConfig);
    SwaggerModule.setup("docs", app, document);
  }
}
