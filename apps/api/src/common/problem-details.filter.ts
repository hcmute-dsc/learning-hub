import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
  Optional,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { ErrorCode, ProblemDetails } from '@hub/shared';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { DomainError } from './errors';
import { ERROR_REPORTER, type ErrorReporter } from './error-reporter';

const TYPE_BASE = 'https://hub.hcmute-dsc.io.vn/errors/';

const STATUS_CODES: Record<number, ErrorCode> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'VALIDATION_FAILED',
  429: 'RATE_LIMITED',
};

/** Map any thrown value to an RFC 9457 problem+json body (BACKEND-DESIGN §3.6). */
export function toProblem(exception: unknown, requestId?: string): ProblemDetails {
  const base = (
    status: number,
    code: ErrorCode,
    title: string,
    detail?: string,
  ): ProblemDetails => ({
    type: TYPE_BASE + code.toLowerCase().replace(/_/g, '-'),
    title,
    status,
    code,
    ...(detail ? { detail } : {}),
    ...(requestId ? { requestId } : {}),
  });

  if (exception instanceof DomainError) {
    return {
      ...base(exception.status, exception.code, exception.message),
      ...(exception.errors ? { errors: exception.errors } : {}),
    };
  }
  if (exception instanceof ZodError) {
    return {
      ...base(422, 'VALIDATION_FAILED', 'Request validation failed'),
      errors: exception.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    };
  }
  if (exception instanceof ThrottlerException) {
    return base(429, 'RATE_LIMITED', 'Too many requests');
  }
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    return base(status, STATUS_CODES[status] ?? 'BAD_REQUEST', exception.message);
  }
  return base(HttpStatus.INTERNAL_SERVER_ERROR, 'INTERNAL_ERROR', 'Unexpected server error');
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  constructor(
    // Optional so the filter still works where no reporter is bound (tests, CLI).
    @Optional() @Inject(ERROR_REPORTER) private readonly reporter?: ErrorReporter,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { id?: string }>();
    const res = ctx.getResponse<Response>();
    const problem = toProblem(exception, req.id ? String(req.id) : undefined);
    if (problem.status >= 500) {
      this.logger.error({ err: exception, requestId: problem.requestId }, 'Unhandled error');
      this.reporter?.report({
        method: req.method,
        url: req.originalUrl ?? req.url,
        requestId: problem.requestId,
        error: exception,
      });
    }
    res.status(problem.status).type('application/problem+json').json(problem);
  }
}
