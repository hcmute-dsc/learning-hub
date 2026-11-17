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

export interface PublishedTrackInfo {
  slug: string;
  title: string;
  isNew: boolean;
  added: string[];
  changed: string[];
}

export interface ContentPublishedInfo {
  commitSha: string;
  /** owner/repo on GitHub (anything else, e.g. local:…, gets no compare link) */
  sourceRepo: string;
  previousCommitSha: string | null;
  tracks: PublishedTrackInfo[];
  /** lessons + exercises taken off the site */
  removed: number;
}

/** At most this many lesson/exercise titles in one message; the rest become "và N bài khác". */
export const MAX_PUBLISHED_TITLES = 12;

const isSha = (v: string | null): v is string => !!v && /^[0-9a-f]{7,40}$/i.test(v);

/**
 * What a content publish changed, by track and by title, so members know what to read
 * (the first version only showed the commit: 18/11/2026). Stays well under Discord's
 * 2000-character limit: titles are cut to 80 characters and capped at MAX_PUBLISHED_TITLES.
 */
export function contentPublishedMessage(origin: string, info: ContentPublishedInfo): string {
  // A sha is hex; anything else is not shown rather than escaped.
  const sha = isSha(info.commitSha) ? info.commitSha.slice(0, 7) : '?';
  const lines = [`📚 **Nội dung mới đã được publish** (commit \`${sha}\`)`];

  let budget = MAX_PUBLISHED_TITLES;
  let hidden = 0;
  const list = (titles: string[]) => {
    const shown = titles.slice(0, Math.max(budget, 0));
    budget -= shown.length;
    hidden += titles.length - shown.length;
    return shown.map((t) => `• ${escapeDiscord(t, 80)}`);
  };

  for (const track of info.tracks) {
    const name = escapeDiscord(track.title, 80);
    lines.push('');
    lines.push(track.isNew ? `🆕 **Lộ trình mới: ${name}**` : `**${name}**`);
    if (track.added.length && !track.isNew) {
      lines.push(`➕ Thêm ${track.added.length} bài:`, ...list(track.added));
    } else if (track.isNew) {
      lines.push(`${track.added.length} bài học và bài tập`);
    }
    if (track.changed.length) {
      lines.push(`✏️ Cập nhật ${track.changed.length} bài:`, ...list(track.changed));
    }
    if (!track.isNew && !track.added.length && !track.changed.length) {
      lines.push('✏️ Cập nhật thông tin lộ trình');
    }
    lines.push(link(origin, `/tracks/${encodeURIComponent(track.slug)}`));
  }
  if (hidden > 0) lines.push(`… và ${hidden} bài khác`);
  if (info.removed > 0) lines.push('', `🗑️ Gỡ ${info.removed} bài khỏi trang`);
  if (!info.tracks.length && !info.removed) {
    lines.push('Không có bài học hay bài tập nào thay đổi.');
  }

  const repoOk = /^[\w.-]+\/[\w.-]+$/.test(info.sourceRepo);
  if (
    repoOk &&
    isSha(info.previousCommitSha) &&
    isSha(info.commitSha) &&
    info.previousCommitSha !== info.commitSha
  ) {
    lines.push(
      '',
      `Xem chi tiết thay đổi: <https://github.com/${info.sourceRepo}/compare/${info.previousCommitSha}...${info.commitSha}>`,
    );
  }
  return lines.join('\n');
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
