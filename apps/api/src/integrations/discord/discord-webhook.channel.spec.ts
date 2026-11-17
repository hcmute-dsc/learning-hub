import { DiscordWebhookChannel } from './discord-webhook.channel';

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
});
