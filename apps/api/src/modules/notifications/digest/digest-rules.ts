import type { InboxPayload } from '../inbox/inbox-messages';

/**
 * Rules of the daily email digest (learning-hub#49, PRD F13). Pure, so they are tested
 * without a clock, a database or an SMTP server.
 */

/** Vietnam has no daylight saving time, so a fixed offset is exact. */
const VN_OFFSET_MS = 7 * 60 * 60_000;
/** The digest goes out after 08:00 Vietnam time, once a day. */
export const DIGEST_HOUR_VN = 8;
/** At most this many notifications are listed; the rest are counted. */
export const DIGEST_MAX_ITEMS = 20;

/** The latest 08:00 (Vietnam time) that is not after `now`. */
export function digestWindowStart(now: Date): Date {
  const local = new Date(now.getTime() + VN_OFFSET_MS);
  const start = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
    DIGEST_HOUR_VN,
  );
  const startUtc = start - VN_OFFSET_MS;
  return new Date(startUtc <= now.getTime() ? startUtc : startUtc - 24 * 60 * 60_000);
}

/** Due when no digest went out since the latest 08:00. */
export function isDigestDue(now: Date, lastDigestAt: Date | null): boolean {
  return lastDigestAt === null || lastDigestAt < digestWindowStart(now);
}

export interface DigestEmail {
  subject: string;
  text: string;
  html: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * The digest email: unread notifications, newest first, with a link to each and an
 * unsubscribe link at the bottom. Returns null when there is nothing to send.
 */
export function buildDigestEmail(input: {
  displayName: string;
  items: InboxPayload[];
  webOrigin: string;
  unsubscribeUrl: string;
}): DigestEmail | null {
  if (!input.items.length) return null;
  const origin = input.webOrigin.replace(/\/+$/, '');
  const shown = input.items.slice(0, DIGEST_MAX_ITEMS);
  const more = input.items.length - shown.length;
  const count = input.items.length;

  const subject = `Learning Hub: ${count} thông báo mới`;
  const greeting = `Chào ${input.displayName},`;
  const intro = `Bạn có ${count} thông báo chưa đọc trên HCMUTE DSC Learning Hub:`;
  const footer =
    'Bạn nhận email này vì đã bật "Email tóm tắt" trong phần Cài đặt của Learning Hub.';

  const textLines = [greeting, '', intro, ''];
  for (const item of shown) {
    textLines.push(`- ${item.title}`);
    if (item.body) textLines.push(`  ${item.body}`);
    textLines.push(`  ${origin}${item.link}`);
  }
  if (more > 0) textLines.push(`… và ${more} thông báo khác`);
  textLines.push(
    '',
    `Xem tất cả: ${origin}/dashboard`,
    '',
    footer,
    `Tắt email này: ${input.unsubscribeUrl}`,
  );

  const htmlItems = shown
    .map((item) => {
      const href = escapeHtml(`${origin}${item.link}`);
      const body = item.body ? `<br><span style="color:#555">${escapeHtml(item.body)}</span>` : '';
      return `<li style="margin:0 0 12px"><a href="${href}">${escapeHtml(item.title)}</a>${body}</li>`;
    })
    .join('');
  const html = [
    '<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#222">',
    `<p>${escapeHtml(greeting)}</p>`,
    `<p>${escapeHtml(intro)}</p>`,
    `<ul style="padding-left:20px">${htmlItems}</ul>`,
    more > 0 ? `<p>… và ${more} thông báo khác</p>` : '',
    `<p><a href="${escapeHtml(`${origin}/dashboard`)}">Mở Learning Hub</a></p>`,
    `<p style="color:#777;font-size:13px">${escapeHtml(footer)} `,
    `<a href="${escapeHtml(input.unsubscribeUrl)}">Tắt email tóm tắt</a></p>`,
    '</div>',
  ].join('');

  return { subject, text: textLines.join('\n'), html };
}
