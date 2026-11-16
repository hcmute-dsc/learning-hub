import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@hub/shared';
import type { Request } from 'express';
import { ALLOW_PENDING, AuthUser, IS_PUBLIC, REQUIRED_ROLES } from '../../common/auth.decorators';
import { DomainError } from '../../common/errors';
import { SessionService } from './session.service';

/** Pure role/status check, unit-tested separately from Nest. */
export function checkAccess(
  user: AuthUser | null,
  opts: { isPublic: boolean; allowPending: boolean; roles: Role[] },
): void {
  if (opts.isPublic) return;
  if (!user) throw DomainError.unauthenticated();
  if (user.status === 'suspended') throw DomainError.forbidden('Your account is suspended');
  if (user.status === 'pending' && !opts.allowPending) throw DomainError.accountPending();
  if (opts.roles.length && !user.roles.includes('admin')) {
    if (!opts.roles.some((r) => user.roles.includes(r))) throw DomainError.forbidden();
  }
}

/**
 * Global guard (SECURITY §2): every route needs a session unless marked @Public().
 * Resource-level rules (owner, assigned mentor…) live in each module's policy.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser | null }>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets) ?? false;
    const token = req.cookies?.[this.sessions.cookieName] as string | undefined;
    const user = await this.sessions.resolve(token);
    req.user = user;
    checkAccess(user, {
      isPublic,
      allowPending: this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING, targets) ?? false,
      roles: this.reflector.getAllAndOverride<Role[]>(REQUIRED_ROLES, targets) ?? [],
    });
    return true;
  }
}
