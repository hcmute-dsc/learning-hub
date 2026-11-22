import { DomainError } from '../../common/errors';
import { GithubContentSource } from './github-content.source';

const HEAD = { sha: 'c'.repeat(40) };
const ok = () => new Response(JSON.stringify(HEAD), { status: 200 });

/** A source whose HTTP client answers from `script`, one entry per call: a Response or a thrown error. */
function setup(script: (Response | Error)[]) {
  const http = jest.fn(async () => {
    const next = script.shift();
    if (!next) throw new Error('no more scripted answers');
    if (next instanceof Error) throw next;
    return next;
  });
  const sleep = jest.fn(async () => undefined);
  const source = new GithubContentSource('hcmute-dsc/x', 'main', undefined, http, sleep);
  return { source, http, sleep };
}

describe('GithubContentSource network errors (#87)', () => {
  it('retries when fetch throws, then returns the answer', async () => {
    const { source, http, sleep } = setup([new TypeError('fetch failed'), ok()]);
    await expect(source.getHead()).resolves.toEqual(HEAD);
    expect(http).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1_000);
  });

  it('answers 502 UPSTREAM_ERROR after 3 failed tries, not a 500', async () => {
    const failed = () => new TypeError('fetch failed');
    const { source, http, sleep } = setup([failed(), failed(), failed()]);
    const error = await source.getHead().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toMatchObject({ code: 'UPSTREAM_ERROR', status: 502 });
    expect(http).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[1_000], [2_000]]);
  });

  it('treats a timeout like a network failure', async () => {
    const timeout = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    const { source } = setup([timeout, timeout, timeout]);
    await expect(source.getHead()).rejects.toMatchObject({ status: 502 });
  });

  it('sends a timeout signal with every request', async () => {
    const { source, http } = setup([ok()]);
    await source.getHead();
    const init = (http.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('does not retry when GitHub answers with an error', async () => {
    const { source, http } = setup([new Response('nope', { status: 500 })]);
    await expect(source.getHead()).rejects.toMatchObject({ code: 'UPSTREAM_ERROR', status: 502 });
    expect(http).toHaveBeenCalledTimes(1);
  });

  it('keeps 404 as not found', async () => {
    const { source } = setup([new Response('', { status: 404 })]);
    await expect(source.getHead()).rejects.toMatchObject({ status: 404 });
  });
});
