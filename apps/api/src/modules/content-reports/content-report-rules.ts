import {
  CONTENT_REPORT_CATEGORY_LABEL,
  CONTENT_REPORT_DAILY_LIMIT,
  CONTENT_REPORT_STATUS_LABEL,
  type ContentReportCategory,
  type ContentReportStatus,
  type ContentReportTarget,
  type Role,
} from '@hub/shared';
import { DomainError } from '../../common/errors';

/**
 * Rules of "Báo lỗi nội dung" (learning-hub#121). Pure functions, tested in
 * content-report-rules.spec.ts.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const SHA = /^[0-9a-f]{40}$/;

/**
 * Who handles reports: admins and every mentor, for every track, the same rule as the
 * review queue (#30) and the track statistics (#118).
 */
export function canHandleContentReports(roles: readonly Role[]): boolean {
  return roles.includes('admin') || roles.includes('mentor');
}

/** Start of the 24 hours counted by the daily limit. */
export function dailyLimitSince(now: Date): Date {
  return new Date(now.getTime() - DAY_MS);
}

/**
 * At most CONTENT_REPORT_DAILY_LIMIT reports per member in 24 hours, so one person (or a
 * script with their cookie) cannot flood the mentors' list. `sentLastDay` = reports already
 * sent since `dailyLimitSince(now)`.
 */
export function assertUnderDailyLimit(
  sentLastDay: number,
  limit = CONTENT_REPORT_DAILY_LIMIT,
): void {
  if (sentLastDay >= limit) {
    throw new DomainError(
      'RATE_LIMITED',
      429,
      `Bạn đã gửi ${limit} báo lỗi trong 24 giờ qua. Hãy thử lại sau, hoặc nhắn mentor trên Discord.`,
    );
  }
}

/**
 * Status changes staff may make: open ⇄ in_progress, either of them → resolved or
 * dismissed, and a closed report may be reopened. Setting the same status is a 409, so a
 * double click does not notify the reporter twice.
 */
const NEXT: Record<ContentReportStatus, ContentReportStatus[]> = {
  open: ['in_progress', 'resolved', 'dismissed'],
  in_progress: ['open', 'resolved', 'dismissed'],
  resolved: ['open'],
  dismissed: ['open'],
};

export function canMoveTo(from: ContentReportStatus, to: ContentReportStatus): boolean {
  return NEXT[from].includes(to);
}

export function assertStatusChange(from: ContentReportStatus, to: ContentReportStatus): void {
  if (!canMoveTo(from, to)) {
    throw DomainError.conflict(
      `Không chuyển được từ "${CONTENT_REPORT_STATUS_LABEL[from]}" sang "${CONTENT_REPORT_STATUS_LABEL[to]}".`,
    );
  }
}

export function isClosed(status: ContentReportStatus): boolean {
  return status === 'resolved' || status === 'dismissed';
}

/** The reporter hears back when their report is closed (resolved or dismissed), not before. */
export function notifiesReporter(from: ContentReportStatus, to: ContentReportStatus): boolean {
  return !isClosed(from) && isClosed(to);
}

/** `closed_at` after a change: set when the report closes, cleared when it is reopened. */
export function closedAtAfter(
  to: ContentReportStatus,
  previous: Date | null,
  now: Date,
): Date | null {
  if (!isClosed(to)) return null;
  return previous ?? now;
}

/** A commit SHA worth storing; local development content has none. */
export function storedCommit(sha: string | null | undefined): string | null {
  return sha && SHA.test(sha) ? sha : null;
}

/** Names of the track pages, as on their tabs. */
export const TRACK_PAGE_LABEL: Record<'setup' | 'resources', string> = {
  setup: 'Cài đặt',
  resources: 'Tài liệu thêm',
};

/** Where the reported content is in the web app. */
export function targetLink(kind: ContentReportTarget, ref: string, trackSlug: string): string {
  switch (kind) {
    case 'lesson':
      return `/lessons/${ref}`;
    case 'exercise':
      return `/exercises/${ref}`;
    case 'track_page':
      return `/tracks/${trackSlug}/${ref}`;
    case 'glossary':
      return `/tracks/${trackSlug}/glossary`;
  }
}

/** True for an "owner/repo" on GitHub (not a `local:` folder used in development). */
export function isGithubRepo(repo: string): boolean {
  return /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(repo);
}

export interface IssueSource {
  category: ContentReportCategory;
  description: string;
  quote: string | null;
  targetTitle: string;
  trackTitle: string;
  /** absolute URL of the page on the hub */
  pageUrl: string;
  commitSha: string | null;
  repo: string;
}

/** Fence a member's text so Markdown, mentions and HTML in it stay plain text on GitHub. */
export function quoted(text: string): string {
  // A fence longer than any run of ~ in the text, so the text cannot close it early.
  const longest = Math.max(0, ...(text.match(/~+/g) ?? []).map((run) => run.length));
  const fence = '~'.repeat(Math.max(3, longest + 1));
  return `${fence}text\n${text}\n${fence}`;
}

/**
 * The issue created in the track repo. On purpose there is nothing about the reporter (no
 * login, no email): the issue is public, and the member did not choose to appear there.
 */
export function issueContent(r: IssueSource): { title: string; body: string } {
  const category = CONTENT_REPORT_CATEGORY_LABEL[r.category];
  const title = `[Báo lỗi] ${r.targetTitle}: ${category}`.slice(0, 200);
  const lines = [
    `Báo lỗi nội dung gửi từ Learning Hub của HCMUTE DSC (learning-hub#121).`,
    '',
    `- **Bài:** [${r.targetTitle}](${r.pageUrl}) (${r.trackTitle})`,
    `- **Loại lỗi:** ${category}`,
  ];
  if (r.commitSha) {
    lines.push(
      `- **Commit nội dung lúc báo:** [\`${r.commitSha.slice(0, 7)}\`](https://github.com/${r.repo}/tree/${r.commitSha})`,
    );
  }
  lines.push('', '**Mô tả**', '', quoted(r.description));
  if (r.quote) lines.push('', '**Đoạn trích**', '', quoted(r.quote));
  return { title, body: lines.join('\n') };
}
