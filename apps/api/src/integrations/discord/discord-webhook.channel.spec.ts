import { ClubPostGoneError } from '../../modules/notifications/ports/notification-channel';
import {
  DiscordWebhookChannel,
  webhookMessageUrl,
  webhookUrlWithWait,
} from './discord-webhook.channel';

const URL = 'https://discord.com/api/webhooks/1/secret-token';

function setup(responses: Array<Response | Error | 'hang'>, timeoutMs = 5_000) {
  const fetch = jest.fn((_url: string, init: RequestInit) => {
    const next = responses.shift();
    if (next === 'hang') {
      // Resolves only when the channel aborts the request.
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    }
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve(next ?? new Response(null, { status: 204 }));
  });
  const sleep = jest.fn(async () => {});
  const logger = { warn: jest.fn() };
  const channel = new DiscordWebhookChannel(URL, 'test', {
    fetch: fetch as unknown as typeof globalThis.fetch,
    sleep,
    logger,
    timeoutMs,
  });
  return { channel, fetch, sleep, logger };
}

describe('DiscordWebhookChannel', () => {
  it('posts the content with mentions turned off', async () => {
    const { channel, fetch, logger } = setup([new Response(null, { status: 204 })]);
    await channel.send('hello');
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(URL);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      content: 'hello',
      allowed_mentions: { parse: [] },
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('cuts content to the Discord limit', async () => {
    const { channel, fetch } = setup([]);
    await channel.send('x'.repeat(3000));
    expect(JSON.parse(fetch.mock.calls[0][1].body as string).content).toHaveLength(2000);
  });

  it('waits retry_after once on 429, then retries', async () => {
    const { channel, fetch, sleep, logger } = setup([
      new Response(JSON.stringify({ retry_after: 1.5 }), { status: 429 }),
      new Response(null, { status: 204 }),
    ]);
    await channel.send('hi');
    expect(sleep).toHaveBeenCalledWith(1500);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('gives up after a second 429', async () => {
    const { channel, fetch, logger } = setup([
      new Response('{"retry_after":1}', { status: 429 }),
      new Response('{"retry_after":1}', { status: 429 }),
    ]);
    await channel.send('hi');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ status: 429 }),
      expect.any(String),
    );
  });

  it('drops the message when the rate-limit wait is too long', async () => {
    const { channel, fetch, sleep } = setup([new Response('{"retry_after":120}', { status: 429 })]);
    await channel.send('hi');
    expect(sleep).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('logs a non-2xx answer instead of throwing, without the URL', async () => {
    const { channel, logger } = setup([new Response('bad', { status: 400 })]);
    await expect(channel.send('hi')).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ status: 400 }),
      expect.any(String),
    );
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('secret-token');
  });

  it('aborts a slow request after the timeout', async () => {
    const { channel, logger } = setup(['hang'], 10);
    await expect(channel.send('hi')).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'AbortError' }),
      expect.any(String),
    );
  });

  it('never throws on a network error', async () => {
    const { channel, logger } = setup([new TypeError('fetch failed')]);
    await expect(channel.send('hi')).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });

  describe('post (embeds from the outbox, learning-hub#76)', () => {
    const A = '111111111111111111';
    const message = {
      content: `hi <@${A}>`,
      embeds: [{ title: 't' }],
      mentionUserIds: [A, A, 'x'],
    };

    it('sends embeds and lets Discord ping only the listed snowflakes', async () => {
      const { channel, fetch } = setup([new Response(null, { status: 204 })]);
      await channel.post(message);
      expect(JSON.parse(fetch.mock.calls[0][1].body as string)).toEqual({
        content: `hi <@${A}>`,
        embeds: [{ title: 't' }],
        allowed_mentions: { parse: [], users: [A] },
      });
    });

    it('throws when Discord refuses, so the outbox retries; never with the URL', async () => {
      const { channel } = setup([new Response('bad', { status: 500 })]);
      const err = await channel.post(message).catch((e: Error) => e);
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain('500');
      expect((err as Error).message).not.toContain('secret-token');
    });

    it('waits a short rate limit once, then succeeds', async () => {
      const { channel, sleep, fetch } = setup([
        Response.json({ retry_after: 0.5 }, { status: 429 }),
        new Response(null, { status: 204 }),
      ]);
      await expect(channel.post(message)).resolves.toEqual({ messageId: null });
      expect(sleep).toHaveBeenCalledWith(500);
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('post with wait and edit (learning-hub#83)', () => {
    const A = '111111111111111111';
    const MSG = '999999999999999999';
    const message = { content: `hi <@${A}>`, embeds: [{ title: 't' }], mentionUserIds: [A] };

    it('builds the ?wait=true and PATCH message URLs, keeping thread_id', () => {
      expect(webhookUrlWithWait(URL)).toBe(`${URL}?wait=true`);
      expect(webhookMessageUrl(URL, MSG)).toBe(`${URL}/messages/${MSG}`);
      expect(webhookMessageUrl(`${URL}?thread_id=42`, MSG)).toBe(
        `${URL}/messages/${MSG}?thread_id=42`,
      );
      expect(webhookMessageUrl(`${URL}/`, MSG)).toBe(`${URL}/messages/${MSG}`);
    });

    it('posts with ?wait=true and returns the message id', async () => {
      const { channel, fetch } = setup([Response.json({ id: MSG })]);
      await expect(channel.post(message)).resolves.toEqual({ messageId: MSG });
      expect(fetch.mock.calls[0][0]).toBe(`${URL}?wait=true`);
    });

    it('edits with PATCH on the message URL and the same allowed_mentions', async () => {
      const { channel, fetch } = setup([Response.json({ id: MSG })]);
      await channel.edit(MSG, message);
      const [url, init] = fetch.mock.calls[0];
      expect(url).toBe(`${URL}/messages/${MSG}`);
      expect(init.method).toBe('PATCH');
      expect(JSON.parse(init.body as string).allowed_mentions).toEqual({ parse: [], users: [A] });
    });

    it('reports a message deleted on Discord as ClubPostGoneError, other errors as Error', async () => {
      const gone = setup([new Response('{}', { status: 404 })]);
      await expect(gone.channel.edit(MSG, message)).rejects.toBeInstanceOf(ClubPostGoneError);
      const down = setup([new Response('bad', { status: 500 })]);
      const err = await down.channel.edit(MSG, message).catch((e: Error) => e);
      expect(err).not.toBeInstanceOf(ClubPostGoneError);
      expect((err as Error).message).not.toContain('secret-token');
    });
  });
});
