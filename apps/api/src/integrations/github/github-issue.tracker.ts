import { DomainError } from '../../common/errors';
import type { IssueTracker } from '../../modules/content-reports/ports/issue-tracker';

const API = 'https://api.github.com';
const TIMEOUT_MS = 20_000;

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Opens issues in track repos for "Tạo issue trên GitHub" (learning-hub#121), with a token
 * that has "Issues: read and write" on the track repos: a fine-grained personal access token
 * of a bot account, or later a GitHub App installation token (SECURITY §10). Not retried:
 * a POST that timed out may have created the issue already.
 */
export class GithubIssueTracker implements IssueTracker {
  readonly enabled = true;

  constructor(
    private readonly token: string,
    /** For tests: the HTTP client. */
    private readonly http: Fetch = fetch,
  ) {}

  async createIssue(
    repo: string,
    issue: { title: string; body: string },
  ): Promise<{ url: string }> {
    let res: Response;
    try {
      res = await this.http(`${API}/repos/${repo}/issues`, {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'learning-hub',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
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
      return 'Token GitHub để tạo issue không hợp lệ hoặc đã hết hạn (CONTENT_ISSUES_GITHUB_TOKEN).';
    case 403:
    case 404:
      return `Token GitHub không có quyền "Issues: write" trên ${repo} (hoặc repo không tồn tại).`;
    case 410:
      return `Repo ${repo} đã tắt Issues.`;
    case 422:
      return 'GitHub từ chối nội dung issue.';
    default:
      return `GitHub trả lỗi ${status} khi tạo issue.`;
  }
}
