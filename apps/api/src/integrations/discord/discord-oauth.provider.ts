import type { Env } from '../../infrastructure/config/env';
import { DomainError } from '../../common/errors';
import {
  DISCORD_ID_PATTERN,
  type DiscordAccount,
  type DiscordAccountProvider,
} from '../../modules/users/ports/discord-account';

const DISCORD = 'https://discord.com';
const TIMEOUT_MS = 10_000;

/**
 * Discord OAuth2 adapter for linking an account (learning-hub#76). Scope `identify`
 * only. The token is used for one GET /users/@me and then dropped; nothing from Discord
 * is logged (the client secret and the token are secrets).
 */
export class DiscordOAuthProvider implements DiscordAccountProvider {
  readonly enabled = true;

  constructor(
    private readonly env: Pick<Env, 'DISCORD_CLIENT_ID' | 'DISCORD_CLIENT_SECRET'>,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  authorizeUrl(input: { state: string; redirectUri: string }): string {
    const url = new URL('/oauth2/authorize', DISCORD);
    url.searchParams.set('client_id', this.env.DISCORD_CLIENT_ID);
    url.searchParams.set('redirect_uri', input.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'identify');
    url.searchParams.set('state', input.state);
    url.searchParams.set('prompt', 'consent');
    return url.toString();
  }

  async fetchAccount(input: { code: string; redirectUri: string }): Promise<DiscordAccount> {
    const tokenRes = await this.fetchFn(`${DISCORD}/api/oauth2/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.env.DISCORD_CLIENT_ID,
        client_secret: this.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: input.code,
        redirect_uri: input.redirectUri,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!tokenRes.ok) throw discordError('Discord refused the sign-in code');
    const token = (await tokenRes.json()) as { access_token?: unknown };
    if (typeof token.access_token !== 'string') throw discordError('Discord sent no token');

    const meRes = await this.fetchFn(`${DISCORD}/api/users/@me`, {
      headers: { authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!meRes.ok) throw discordError('Could not read the Discord account');
    const me = (await meRes.json()) as { id?: unknown; username?: unknown };
    if (typeof me.id !== 'string' || !DISCORD_ID_PATTERN.test(me.id)) {
      throw discordError('Discord sent an unexpected account id');
    }
    const username = typeof me.username === 'string' ? me.username.slice(0, 64) : me.id;
    return { id: me.id, username };
  }
}

/** Used when DISCORD_CLIENT_ID/SECRET are empty: linking is off. */
export class DisabledDiscordAccountProvider implements DiscordAccountProvider {
  readonly enabled = false;
  authorizeUrl(): string {
    throw discordError('Discord linking is not configured');
  }
  fetchAccount(): Promise<DiscordAccount> {
    return Promise.reject(discordError('Discord linking is not configured'));
  }
}

function discordError(message: string): DomainError {
  return new DomainError('UPSTREAM_ERROR', 502, message);
}
