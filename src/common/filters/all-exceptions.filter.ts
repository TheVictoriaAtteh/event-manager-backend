import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

interface ResolvedError {
  status: number;
  message: unknown;
  error?: string;
  [key: string]: unknown;
}


@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const resolved = this.resolve(exception);
    const { status, error } = resolved;

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const extra: Record<string, unknown> = { ...resolved };
    delete extra.status;
    delete extra.error;
    delete extra.statusCode;

    const body: Record<string, unknown> = {
      ...extra,
      statusCode: status,
      ...(error ? { error } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
  }

  private resolve(exception: unknown): ResolvedError {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        return { status, message: res, error: exception.name };
      }
      // Preserve every field of the structured response (message, code, ...)
      // so API consumers can rely on machine-readable error codes.
      const body = res as Record<string, unknown>;
      return {
        ...body,
        status,
        message: body.message ?? exception.message,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          return {
            status: HttpStatus.CONFLICT,
            message: 'A record with this value already exists',
            error: 'Conflict',
          };
        case 'P2025':
          return {
            status: HttpStatus.NOT_FOUND,
            message: 'Record not found',
            error: 'Not Found',
          };
        case 'P2003':
          return {
            status: HttpStatus.BAD_REQUEST,
            message: 'Invalid reference to related record',
            error: 'Bad Request',
          };
        default:
          return {
            status: HttpStatus.BAD_REQUEST,
            message: 'Database request failed',
            error: 'Bad Request',
          };
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
    };
  }
}
