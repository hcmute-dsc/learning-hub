import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { ENV, type Env } from '../infrastructure/config/env';
import { DomainError } from './errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence in depth (SECURITY §5): together with SameSite=Lax cookies, reject
 * state-changing requests whose Origin is not the web app. Webhooks are exempt
 * because they are authenticated by HMAC, not cookies.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;
    if (req.path.includes('/integrations/')) return true;
    const origin = req.headers.origin;
    if (origin && origin === new URL(this.env.WEB_ORIGIN).origin) return true;
    throw DomainError.forbidden('Cross-site request rejected');
  }
}
