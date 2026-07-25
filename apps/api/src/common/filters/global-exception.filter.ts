import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

import { Prisma } from "@gym-platform/database";
import { redactSensitiveRecord } from "@gym-platform/observability";

import { DomainError } from "../errors/domain-error.js";

type RequestWithCorrelationId = FastifyRequest & {
  correlationId?: string;
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<FastifyReply>();
    const request = context.getRequest<RequestWithCorrelationId>();

    const payload = this.toPayload(exception, request.correlationId);

    if (payload.statusCode >= 500) {
      console.error(
        "Unhandled API error",
        redactSensitiveRecord({
          correlationId: request.correlationId,
          method: request.method,
          url: request.url,
          message: readSafeErrorMessage(exception)
        })
      );
    }

    response.status(payload.statusCode).send(payload);
  }

  private toPayload(exception: unknown, correlationId: string | undefined) {
    if (exception instanceof DomainError) {
      return {
        statusCode: exception.statusCode,
        code: exception.code,
        message: exception.message,
        correlationId
      };
    }

    if (exception instanceof ZodError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: "VALIDATION_ERROR",
        message: "Os dados informados são inválidos.",
        details: exception.flatten(),
        correlationId
      };
    }

    if (exception instanceof HttpException) {
      return {
        statusCode: exception.getStatus(),
        code: "HTTP_ERROR",
        message: exception.message,
        correlationId
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error.",
      correlationId
    };
  }
}

export function readSafeErrorMessage(exception: unknown): string {
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    return `Database request failed (${exception.code}).`;
  }

  if (
    exception instanceof Prisma.PrismaClientUnknownRequestError ||
    exception instanceof Prisma.PrismaClientInitializationError ||
    exception instanceof Prisma.PrismaClientRustPanicError
  ) {
    return "Database request failed.";
  }

  if (exception instanceof Error) {
    return exception.name === "Error" ? "Unhandled application error." : exception.name;
  }

  return "Unknown error.";
}
