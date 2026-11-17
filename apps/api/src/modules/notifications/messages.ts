/**
 * Pure builders for the Discord messages (E9 club channel, E11 alert channel).
 * Titles come from the content repo and logins from GitHub, so every value is
 * escaped: no markdown tricks, no @everyone/@here, no fake links.
 * Never put emails or other personal data in here: the club channel is wide open.
 */

const MAX_FIELD = 200;
const ZERO_WIDTH_SPACE = '​';

/** One-line, markdown-free, mention-free text for a value inside a message. */
export function escapeDiscord(value: string, max = MAX_FIELD): string {
  const oneLine = value.replace(/\s+/g, ' ').trim();
  const short = oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
  return (
    short
      // markdown: bold/italic/strike/code/spoiler/quote/heading/list/links
      .replace(/[\\*_~`|>#\-[\]()<]/g, '\\$&')
      // "@everyone" stays readable but is no longer a mention
      .replace(/@/g, `@${ZERO_WIDTH_SPACE}`)
  );
}

/** Text inside a ``` code block: only a backtick run could break out of it. */
function codeSafe(value: string, max: number): string {
  const text = value.replace(/`/g, "'").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** `<url>` so Discord shows the link without a big preview card. */
function link(origin: string, path: string): string {
  return `<${origin.replace(/\/+$/, '')}${path}>`;
}

export interface AwaitingReviewInfo {
  submissionId: string;
  exerciseTitle: string;
  trackTitle: string;
  memberLogin: string;
}

export function awaitingReviewMessage(origin: string, info: AwaitingReviewInfo): string {
  return [
    `📝 **Bài chờ review**: ${escapeDiscord(info.exerciseTitle)} (${escapeDiscord(info.trackTitle)})`,
    `Thành viên: ${escapeDiscord(info.memberLogin, 40)}`,
    link(origin, `/review/${encodeURIComponent(info.submissionId)}`),
  ].join('\n');
}

export interface ReviewCompletedInfo {
  exerciseTitle: string;
  trackTitle: string;
  memberLogin: string;
  outcome: 'approved' | 'changes_requested';
}

export function reviewCompletedMessage(info: ReviewCompletedInfo): string {
  const result = info.outcome === 'approved' ? '✅ Đạt' : '🔁 Cần sửa';
  return [
    `**Review xong** — ${result}: ${escapeDiscord(info.exerciseTitle)} (${escapeDiscord(info.trackTitle)})`,
    `Thành viên: ${escapeDiscord(info.memberLogin, 40)}`,
  ].join('\n');
}

export function contentPublishedMessage(origin: string, commitSha: string): string {
  // A sha is hex; anything else is not shown rather than escaped.
  const sha = /^[0-9a-f]{7,40}$/i.test(commitSha) ? commitSha.slice(0, 7) : '?';
  return [`📚 **Nội dung mới đã được publish** (commit \`${sha}\`)`, link(origin, '/tracks')].join(
    '\n',
  );
}

export interface ServerErrorInfo {
  method: string;
  /** path without the query string (it may carry personal data) */
  path: string;
  requestId?: string;
  errorName: string;
  errorMessage: string;
  /** alerts dropped by the throttle since the last one that was sent */
  suppressed: number;
}

export function serverErrorMessage(info: ServerErrorInfo): string {
  const lines = [
    `🚨 **Lỗi 500 trên API**: \`${codeSafe(`${info.method} ${info.path}`, 200)}\``,
    `requestId: \`${codeSafe(info.requestId ?? 'không có', 64)}\``,
    '```',
    codeSafe(`${info.errorName}: ${errorSummary(info.errorMessage)}`, 500),
    '```',
  ];
  if (info.suppressed > 0) {
    lines.push(`(${info.suppressed} cảnh báo khác đã bị gộp để tránh spam)`);
  }
  return lines.join('\n');
}

/**
 * The part of an error message worth reading in Discord. Prisma messages start with the
 * failing call, a code excerpt and server file paths, and end with the cause ("Can't
 * reach database server at …"), so a multi-line message keeps only its last line
 * (seen in the first end-to-end test, 17/11/2026).
 */
export function errorSummary(message: string): string {
  const lines = message
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length > 1 ? lines[lines.length - 1] : (lines[0] ?? '');
}

/** Drop the query string: it may hold search terms or tokens. */
export function pathWithoutQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}
