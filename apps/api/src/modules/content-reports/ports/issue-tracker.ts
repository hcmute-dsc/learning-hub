import { DomainError } from '../../../common/errors';

/**
 * Port owned by the content-reports module (learning-hub#121): open an issue in a track
 * repo. The adapter (integrations/github/github-issue.tracker.ts) calls the GitHub REST API
 * as the organization's GitHub App, which needs "Issues: write" on the track repos.
 */
export interface IssueTracker {
  /** false when no token is configured: the staff page hides the button */
  readonly enabled: boolean;
  /** `repo` is "owner/name". Throws a DomainError the staff can act on. */
  createIssue(repo: string, issue: { title: string; body: string }): Promise<{ url: string }>;
}

export const ISSUE_TRACKER = Symbol('ISSUE_TRACKER');

/** Used when GITHUB_APP_CLIENT_ID or GITHUB_APP_PRIVATE_KEY is empty. */
export class DisabledIssueTracker implements IssueTracker {
  readonly enabled = false;

  async createIssue(): Promise<{ url: string }> {
    throw new DomainError(
      'UPSTREAM_ERROR',
      503,
      'Chưa cấu hình GitHub App để tạo issue (GITHUB_APP_CLIENT_ID, GITHUB_APP_PRIVATE_KEY). Hãy tạo issue bằng tay.',
    );
  }
}
