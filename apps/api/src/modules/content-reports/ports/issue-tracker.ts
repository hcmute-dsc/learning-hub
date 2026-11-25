import { DomainError } from '../../../common/errors';

/**
 * Port owned by the content-reports module (learning-hub#121): open an issue in a track
 * repo. The adapter (integrations/github/github-issue.tracker.ts) calls the GitHub REST API
 * with a token that has "Issues: write" on the track repos.
 */
export interface IssueTracker {
  /** false when no token is configured: the staff page hides the button */
  readonly enabled: boolean;
  /** `repo` is "owner/name". Throws a DomainError the staff can act on. */
  createIssue(repo: string, issue: { title: string; body: string }): Promise<{ url: string }>;
}

export const ISSUE_TRACKER = Symbol('ISSUE_TRACKER');

/** Used when CONTENT_ISSUES_GITHUB_TOKEN is empty. */
export class DisabledIssueTracker implements IssueTracker {
  readonly enabled = false;

  async createIssue(): Promise<{ url: string }> {
    throw new DomainError(
      'UPSTREAM_ERROR',
      503,
      'Chưa cấu hình tạo issue GitHub (CONTENT_ISSUES_GITHUB_TOKEN). Hãy tạo issue bằng tay.',
    );
  }
}
