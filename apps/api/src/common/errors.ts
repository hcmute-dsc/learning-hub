import type { ErrorCode } from '@hub/shared';

/**
 * Business error with a stable code. Thrown by services, mapped to problem+json
 * by ProblemDetailsFilter. Never put secrets or internal details in `detail`.
 */
export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
    message: string,
    readonly errors?: { path: string; message: string }[],
  ) {
    super(message);
  }

  static notFound(what: string): DomainError {
    return new DomainError('NOT_FOUND', 404, `${what} not found`);
  }

  static conflict(message: string): DomainError {
    return new DomainError('CONFLICT', 409, message);
  }

  static forbidden(message = 'You do not have permission to do this'): DomainError {
    return new DomainError('FORBIDDEN', 403, message);
  }

  static unauthenticated(): DomainError {
    return new DomainError('UNAUTHENTICATED', 401, 'Sign in required');
  }

  static accountPending(): DomainError {
    return new DomainError('ACCOUNT_PENDING', 403, 'Your account is waiting for approval');
  }
}
