import { DomainError } from '../../common/errors';
import type { IssueTracker } from '../../modules/content-reports/ports/issue-tracker';
import type { Fetch, GithubAppTokens } from './github-app.auth';

const API = 'https://api.github.com';
const TIMEOUT_MS = 20_000;

/**
 * Opens issues in track repos for "Tạo issue trên GitHub" (learning-hub#121), as the
 * organization's GitHub App (SECURITY §10): an installation token limited to the one repo
 * and to "Issues: write". Not retried: a POST that timed out may have created the issue.
 */
export class GithubIssueTracker implements IssueTracker {
  readonly enabled = true;

  constructor(
    private readonly tokens: Pick<GithubAppTokens, 'issuesToken'>,
    /** For tests: the HTTP client. */
    private readonly http: Fetch = fetch,
  ) {}

  async createIssue(
    repo: string,
    issue: { title: string; body: string },
  ): Promise<{ url: string }> {
    const token = await this.tokens.issuesToken(repo);
    let res: Response;
    try {
      res = await this.http(`${API}/repos/${repo}/issues`, {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'learning-hub',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: issue.title, body: issue.body }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new DomainError(
        'UPSTREAM_ERROR',
        502,
        'Không kết nối được GitHub. Kiểm tra repo xem issue đã được tạo chưa rồi thử lại.',
      );
    }
    if (res.status === 201) {
      const created = (await res.json()) as { html_url?: unknown };
      if (typeof created.html_url === 'string') return { url: created.html_url };
      throw new DomainError('UPSTREAM_ERROR', 502, 'GitHub không trả về link issue');
    }
    throw new DomainError('UPSTREAM_ERROR', 502, failureMessage(res.status, repo));
  }
}

/** What the staff (or the tech team) can do about a refused request. */
export function failureMessage(status: number, repo: string): string {
  switch (status) {
    case 401:
    case 403:
    case 404:
      return `GitHub App của CLB không có quyền "Issues: write" trên ${repo} (hoặc repo không tồn tại).`;
    case 410:
      return `Repo ${repo} đã tắt Issues.`;
    case 422:
      return 'GitHub từ chối nội dung issue.';
    default:
      return `GitHub trả lỗi ${status} khi tạo issue.`;
  }
}
