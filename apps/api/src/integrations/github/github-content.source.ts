import { DomainError } from '../../common/errors';
import type { ContentSource } from '../../modules/content/ports/content-source';

const API = 'https://api.github.com';
const RAW = 'https://raw.githubusercontent.com';
const SHA = /^[0-9a-f]{40}$/;
/** One GitHub request may take this long before it counts as a network failure. */
const TIMEOUT_MS = 20_000;
/** Network failures (no response at all) are retried; GitHub's own error answers are not. */
const ATTEMPTS = 3;
const RETRY_DELAY_MS = 1_000;

type Fetch = (url: string, init: RequestInit) => Promise<Response>;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Reads learning-hub-content from GitHub at an exact commit (ARCHITECTURE §7).
 * - HEAD and the file list use the REST API (2 calls per sync).
 * - Public repo without a token: file bodies come from raw.githubusercontent.com,
 *   which does not use the 60 requests/hour API budget.
 * - With a token (private repo or higher limits): the contents API.
 * Later this switches to GitHub App installation tokens (SECURITY §10).
 */
export class GithubContentSource implements ContentSource {
  readonly sourceRepo: string;

  constructor(
    private readonly repo: string,
    private readonly branch: string,
    private readonly token?: string,
    /** For tests: the HTTP client and the pause between retries. */
    private readonly http: Fetch = fetch,
    private readonly sleep: (ms: number) => Promise<void> = wait,
  ) {
    this.sourceRepo = repo;
  }

  private headers(accept = 'application/vnd.github+json'): Record<string, string> {
    return {
      Accept: accept,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'learning-hub',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
    };
  }

  private async get(url: string, accept?: string): Promise<Response> {
    const res = await this.fetchWithRetry(url, accept);
    if (res.status === 404) throw DomainError.notFound(`GitHub resource ${url.replace(API, '')}`);
    if (res.status === 403 || res.status === 429) {
      throw new DomainError(
        'UPSTREAM_ERROR',
        503,
        'GitHub rate limit reached; set CONTENT_GITHUB_TOKEN or retry later',
      );
    }
    if (!res.ok) throw new DomainError('UPSTREAM_ERROR', 502, `GitHub responded ${res.status}`);
    return res;
  }

  /**
   * `fetch` throws (TypeError "fetch failed", or a timeout) when there is no response at all:
   * DNS, a dropped connection, GitHub not answering. That used to escape as a 500 (#87).
   * GETs are safe to repeat, so try again a couple of times, then answer 502 with a message
   * the admin can act on.
   */
  private async fetchWithRetry(url: string, accept?: string): Promise<Response> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.http(url, {
          headers: this.headers(accept),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch {
        if (attempt >= ATTEMPTS) {
          throw new DomainError(
            'UPSTREAM_ERROR',
            502,
            'Could not reach GitHub; try again in a minute',
          );
        }
        await this.sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  async getHead(): Promise<{ sha: string }> {
    const res = await this.get(
      `${API}/repos/${this.repo}/commits/${encodeURIComponent(this.branch)}`,
    );
    const body = (await res.json()) as { sha: string };
    return { sha: body.sha };
  }

  async listFiles(sha: string): Promise<string[]> {
    if (!SHA.test(sha))
      throw new DomainError('BAD_REQUEST', 400, 'commitSha must be 40 hex characters');
    const res = await this.get(`${API}/repos/${this.repo}/git/trees/${sha}?recursive=1`);
    const body = (await res.json()) as {
      truncated: boolean;
      tree: { path: string; type: string }[];
    };
    if (body.truncated) {
      throw new DomainError(
        'UPSTREAM_ERROR',
        502,
        'Content repo tree is too large for one GitHub listing',
      );
    }
    return body.tree.filter((e) => e.type === 'blob').map((e) => e.path);
  }

  async readFile(sha: string, path: string): Promise<string> {
    const encoded = path.split('/').map(encodeURIComponent).join('/');
    const res = this.token
      ? await this.get(
          `${API}/repos/${this.repo}/contents/${encoded}?ref=${sha}`,
          'application/vnd.github.raw',
        )
      : await this.get(`${RAW}/${this.repo}/${sha}/${encoded}`, 'text/plain');
    return res.text();
  }
}
