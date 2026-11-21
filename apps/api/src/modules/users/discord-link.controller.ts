import { Controller, Delete, Get, HttpCode, Inject, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { DiscordLinkResult } from '@hub/shared';
import type { Request, Response } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { AuthUser, CurrentUser } from '../../common/auth.decorators';
import { DomainError } from '../../common/errors';
import { ENV, type Env } from '../../infrastructure/config/env';
import { DiscordLinkService } from './discord-link.service';

const STATE_COOKIE = 'hub_discord';
const COOKIE_PATH = '/api/v1/me/discord';
const STATE_TTL_MS = 10 * 60 * 1000;

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * "Kết nối Discord" in /settings (learning-hub#76): OAuth2 authorization code + state,
 * scope `identify`. Signed-in active members only (global SessionGuard).
 */
@ApiTags('me')
@Controller('me/discord')
export class DiscordLinkController {
  constructor(
    private readonly discord: DiscordLinkService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private get redirectUri(): string {
    return new URL(`${COOKIE_PATH}/callback`, this.env.WEB_ORIGIN).toString();
  }

  private settings(result: DiscordLinkResult): string {
    return new URL(`/settings?discord=${result}#discord`, this.env.WEB_ORIGIN).toString();
  }

  @Get()
  status(@CurrentUser() user: AuthUser) {
    return this.discord.status(user.id).then((data) => ({ data }));
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('connect')
  connect(@Res() res: Response): void {
    const state = randomBytes(16).toString('base64url');
    const url = this.discord.authorizeUrl(state, this.redirectUri);
    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      secure: this.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: COOKIE_PATH,
      maxAge: STATE_TTL_MS,
    });
    res.redirect(url);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('callback')
  async callback(
    @CurrentUser() user: AuthUser,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const expected = (req.cookies?.[STATE_COOKIE] as string | undefined) ?? '';
    res.clearCookie(STATE_COOKIE, { path: COOKIE_PATH });
    // Also covers "Cancel" on Discord's page, which comes back with ?error=access_denied.
    if (!code || !state || !expected || !safeEqual(state, expected)) {
      res.redirect(this.settings('error'));
      return;
    }
    try {
      await this.discord.complete(user.id, code, this.redirectUri);
      res.redirect(this.settings('linked'));
    } catch (err) {
      const taken = err instanceof DomainError && err.code === 'CONFLICT';
      res.redirect(this.settings(taken ? 'taken' : 'error'));
    }
  }

  @Delete()
  @HttpCode(200)
  async unlink(@CurrentUser() user: AuthUser) {
    await this.discord.unlink(user.id);
    return { data: await this.discord.status(user.id) };
  }
}
