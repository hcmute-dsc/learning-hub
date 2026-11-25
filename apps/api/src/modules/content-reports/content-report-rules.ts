import {
  canHandleContentReports,
  CONTENT_REPORT_CATEGORY_LABEL,
  CONTENT_REPORT_DAILY_LIMIT,
  CONTENT_REPORT_STATUS_LABEL,
  type ContentReportCategory,
  type ContentReportStatus,
  type ContentReportTarget,
} from '@hub/shared';
import { DomainError } from '../../common/errors';

/**
 * Rules of "Báo lỗi nội dung" (learning-hub#121). Pure functions, tested in
 * content-report-rules.spec.ts.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const SHA = /^[0-9a-f]{40}$/;

/** Who handles reports: the shared rule (admins and every mentor), re-exported for the API. */
export { canHandleContentReports };

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

/** A "Tạo issue trên GitHub" claim older than this may be taken again (the API stopped). */
export const ISSUE_CLAIM_MINUTES = 5;

export function issueClaimCutoff(now: Date): Date {
  return new Date(now.getTime() - ISSUE_CLAIM_MINUTES * 60 * 1000);
}

/** One issue per report, and only while the report is still being handled. */
export function assertCanCreateIssue(status: ContentReportStatus, issueUrl: string | null): void {
  if (issueUrl) throw DomainError.conflict('Báo cáo này đã có issue trên GitHub.');
  if (isClosed(status)) {
    throw DomainError.conflict('Báo cáo đã đóng. Mở lại báo cáo trước khi tạo issue.');
  }
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
