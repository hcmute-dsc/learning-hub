import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role, UserStatus } from '@hub/shared';

/** The signed-in user attached to the request by SessionGuard. */
export interface AuthUser {
  id: string;
  githubLogin: string;
  status: UserStatus;
  roles: Role[];
}

export const IS_PUBLIC = 'auth:isPublic';
export const ALLOW_PENDING = 'auth:allowPending';
export const REQUIRED_ROLES = 'auth:roles';

/** Endpoint is reachable without a session. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Endpoint is reachable by users whose account is still `pending` (e.g. GET /auth/me). */
export const AllowPending = () => SetMetadata(ALLOW_PENDING, true);

/** User needs at least one of these roles. `admin` always passes. */
export const Roles = (...roles: Role[]) => SetMetadata(REQUIRED_ROLES, roles);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest<{ user: AuthUser }>().user,
);
