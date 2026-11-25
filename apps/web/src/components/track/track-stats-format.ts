/** Pure helpers for the track statistics page (learning-hub#118), tested in track-stats-format.test.ts. */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Width of a bar, 0–100, against the largest value; 0 when everything is 0. */
export function barPercent(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, Math.round((value / max) * 100));
}

/** value / whole as "33%"; "0%" when whole is 0. */
export function shareText(value: number, whole: number): string {
  return `${whole === 0 ? 0 : Math.round((value / whole) * 100)}%`;
}

/** "23/11" from "2026-11-23" (the Monday of a week in the weekly chart). */
export function weekLabel(weekStart: string): string {
  const [, m, d] = weekStart.split('-');
  return `${d}/${m}`;
}

/** How long a submission has waited: "5 giờ" under two days, else "3 ngày". */
export function waitingText(hours: number): string {
  if (hours < 1) return 'dưới 1 giờ';
  if (hours < 48) return `${Math.floor(hours)} giờ`;
  return `${Math.floor(hours / 24)} ngày`;
}

/** "12 ngày trước", or "Chưa hoạt động" for a learner who never marked a lesson nor submitted. */
export function lastActiveText(iso: string | null, now: Date): string {
  if (!iso) return 'Chưa hoạt động';
  const days = Math.floor((now.getTime() - Date.parse(iso)) / DAY_MS);
  return days <= 0 ? 'Hôm nay' : `${days} ngày trước`;
}

/** The progress report for the same track and days, where the totals come from. */
export function adminReportsHref(trackSlug: string, period: { from: string; to: string }): string {
  const params = new URLSearchParams({ track: trackSlug, from: period.from, to: period.to });
  return `/admin/reports?${params.toString()}`;
}

/** A member's public profile. */
export function profileHref(githubLogin: string): string {
  return `/u/${encodeURIComponent(githubLogin)}`;
}
