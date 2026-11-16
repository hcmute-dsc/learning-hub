import { DomainError } from '../../common/errors';
import type { ContentSource } from '../../modules/content/ports/content-source';

const API = 'https://api.github.com';
const RAW = 'https://raw.githubusercontent.com';
const SHA = /^[0-9a-f]{40}$/;

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
    const res = await fetch(url, { headers: this.headers(accept) });
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
