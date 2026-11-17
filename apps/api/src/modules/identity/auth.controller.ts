import { Controller, Get, HttpCode, Inject, Post, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { AllowPending, AuthUser, CurrentUser, Public } from '../../common/auth.decorators';
import { ENV, type Env } from '../../infrastructure/config/env';
import { UsersService } from '../users/users.service';
import { IDENTITY_PROVIDER, type IdentityProvider } from './ports/identity-provider';
import { SessionService } from './session.service';

const OAUTH_COOKIE = 'hub_oauth';
const OAUTH_TTL_MS = 10 * 60 * 1000;

const b64url = (buf: Buffer) => buf.toString('base64url');

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** GitHub OAuth (authorization code + PKCE + state) — USER-FLOWS §1, SECURITY §1. */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(IDENTITY_PROVIDER) private readonly idp: IdentityProvider,
    private readonly sessions: SessionService,
    private readonly users: UsersService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private get redirectUri(): string {
    return new URL('/api/v1/auth/github/callback', this.env.WEB_ORIGIN).toString();
  }

  private webUrl(path: string): string {
    return new URL(path, this.env.WEB_ORIGIN).toString();
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('github/login')
  login(@Res() res: Response): void {
    const state = b64url(randomBytes(16));
    const verifier = b64url(randomBytes(32));
    const challenge = b64url(createHash('sha256').update(verifier).digest());
    res.cookie(OAUTH_COOKIE, `${state}.${verifier}`, {
      httpOnly: true,
      secure: this.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: OAUTH_TTL_MS,
    });
    res.redirect(
      this.idp.authorizeUrl({ state, codeChallenge: challenge, redirectUri: this.redirectUri }),
    );
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('github/callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const stored = (req.cookies?.[OAUTH_COOKIE] as string | undefined) ?? '';
    res.clearCookie(OAUTH_COOKIE, { path: '/api/v1/auth' });
    const [expectedState, verifier] = stored.split('.');
    if (!code || !state || !expectedState || !verifier || !safeEqual(state, expectedState)) {
      res.redirect(this.webUrl('/login?error=state'));
      return;
    }

    const profile = await this.idp.fetchProfile({
      code,
      codeVerifier: verifier,
      redirectUri: this.redirectUri,
    });
    const user = await this.users.upsertFromGithub(profile);
    // A session would be refused on every request anyway; say why instead of /pending.
    if (user.status === 'suspended') {
      res.redirect(this.webUrl('/login?error=suspended'));
      return;
    }
    const token = await this.sessions.create(user.id, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    res.cookie(this.sessions.cookieName, token, this.sessions.cookieOptions);
    res.redirect(this.webUrl(user.status === 'active' ? '/dashboard' : '/pending'));
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.sessions.destroy(req.cookies?.[this.sessions.cookieName] as string | undefined);
    res.clearCookie(this.sessions.cookieName, { path: '/' });
  }

  @AllowPending()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.users.getMe(user.id).then((data) => ({ data }));
  }
}
