import { Logger } from '@nestjs/common';
import type { NotificationChannel } from '../../modules/notifications/ports/notification-channel';

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

/**
 * Posts plain-text messages to one Discord channel webhook.
 * - 5 s timeout per request, so a slow Discord never piles up pending sends.
 * - On 429 waits `retry_after` once and retries; then gives up.
 * - Never throws and never logs the URL (the URL itself is the secret).
 */
export class DiscordWebhookChannel implements NotificationChannel {
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
      let res = await this.post(body);
      if (res.status === 429) {
        const waitMs = await retryAfterMs(res);
        if (waitMs > MAX_RETRY_WAIT_MS) {
          this.logger.warn({ channel: this.name, waitMs }, 'Discord rate limit too long, dropped');
          return;
        }
        await this.sleep(waitMs);
        res = await this.post(body);
      }
      if (!res.ok) {
        this.logger.warn({ channel: this.name, status: res.status }, 'Discord webhook refused');
      }
    } catch (err) {
      const reason = err instanceof Error ? err.name : 'unknown';
      this.logger.warn({ channel: this.name, reason }, 'Discord webhook failed');
    }
  }

  private async post(body: string): Promise<Response> {
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
