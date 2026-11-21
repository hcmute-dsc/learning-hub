import { Logger } from '@nestjs/common';
import type {
  ClubPost,
  ClubPoster,
  NotificationChannel,
} from '../../modules/notifications/ports/notification-channel';

/** Discord rejects messages longer than this. */
const DISCORD_MAX_CONTENT = 2000;
/** A rate-limit wait longer than this is not worth holding a message for. */
const MAX_RETRY_WAIT_MS = 10_000;

export interface DiscordWebhookOptions {
  timeoutMs?: number;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  logger?: Pick<Logger, 'warn'>;
}

/** Discord ids only: a mention list must never carry anything else. */
const SNOWFLAKE = /^[0-9]{15,21}$/;

/**
 * Posts messages to one Discord channel webhook.
 * - 5 s timeout per request, so a slow Discord never piles up pending sends.
 * - On 429 waits `retry_after` once and retries; then gives up.
 * - `send` (plain text) never throws; `post` (embeds, from the outbox) throws on failure
 *   so the outbox retries. Neither ever logs the URL (the URL itself is the secret).
 */
export class DiscordWebhookChannel implements NotificationChannel, ClubPoster {
  readonly enabled = true;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly logger: Pick<Logger, 'warn'>;

  constructor(
    private readonly url: string,
    private readonly name: string,
    options: DiscordWebhookOptions = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? 5_000;
    this.fetchFn = options.fetch ?? fetch;
    this.sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.logger = options.logger ?? new Logger(`DiscordWebhook:${name}`);
  }

  async send(content: string): Promise<void> {
    try {
      const body = JSON.stringify({
        content: content.slice(0, DISCORD_MAX_CONTENT),
        // Belt and braces with the escaping in messages.ts: Discord pings nobody.
        allowed_mentions: { parse: [] },
      });
      let res = await this.request(body);
      if (res.status === 429) {
        const waitMs = await retryAfterMs(res);
        if (waitMs > MAX_RETRY_WAIT_MS) {
          this.logger.warn({ channel: this.name, waitMs }, 'Discord rate limit too long, dropped');
          return;
        }
        await this.sleep(waitMs);
        res = await this.request(body);
      }
      if (!res.ok) {
        this.logger.warn({ channel: this.name, status: res.status }, 'Discord webhook refused');
      }
    } catch (err) {
      const reason = err instanceof Error ? err.name : 'unknown';
      this.logger.warn({ channel: this.name, reason }, 'Discord webhook failed');
    }
  }

  /**
   * Embed post with explicit mentions (learning-hub#76): `allowed_mentions.parse` is
   * empty, so only the listed users can be pinged, never @everyone or a role.
   */
  async post(message: ClubPost): Promise<void> {
    const body = JSON.stringify({
      content: message.content.slice(0, DISCORD_MAX_CONTENT),
      embeds: message.embeds,
      allowed_mentions: {
        parse: [],
        users: [...new Set(message.mentionUserIds.filter((id) => SNOWFLAKE.test(id)))].slice(
          0,
          100,
        ),
      },
    });
    let res = await this.request(body);
    if (res.status === 429) {
      const waitMs = await retryAfterMs(res);
      if (waitMs > MAX_RETRY_WAIT_MS) throw new Error(`Discord rate limit ${waitMs} ms`);
      await this.sleep(waitMs);
      res = await this.request(body);
    }
    if (!res.ok) throw new Error(`Discord webhook refused: HTTP ${res.status}`);
  }

  private async request(body: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    timer.unref?.();
    try {
      return await this.fetchFn(this.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Discord sends `retry_after` (seconds) in the JSON body; the header is the fallback. */
async function retryAfterMs(res: Response): Promise<number> {
  let seconds = Number.NaN;
  try {
    const data = (await res.json()) as { retry_after?: unknown };
    seconds = Number(data.retry_after);
  } catch {
    // body was not JSON
  }
  if (!Number.isFinite(seconds)) seconds = Number(res.headers.get('retry-after'));
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 1;
  return Math.ceil(seconds * 1000);
}
