import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Observable } from "rxjs";

import { normalizeCorrelationId } from "@gym-platform/observability";

type RequestWithCorrelationId = FastifyRequest & {
  correlationId?: string;
};

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithCorrelationId>();
    const response = http.getResponse<FastifyReply>();
    const correlationId = normalizeCorrelationId(request.headers["x-correlation-id"]);

    request.correlationId = correlationId;
    response.header("x-correlation-id", correlationId);

    return next.handle();
  }
}
