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

// ---- learning-hub#126: period, comparison, chart scales, where learners stop ----

/** The stats page for another period (`?days=`); the default period keeps a clean URL. */
export function statsHref(trackSlug: string, days: number, defaultDays: number): string {
  const base = `/tracks/${encodeURIComponent(trackSlug)}/stats`;
  return days === defaultDays ? base : `${base}?days=${days}`;
}

/** How a number moved against the previous period, and whether that is good news. */
export interface Change {
  diff: number;
  tone: 'good' | 'bad' | 'same';
}

/**
 * current − previous, rounded to one decimal (hours). Null when either side is missing
 * (no review in one of the periods). `higherIsBetter` is false for waiting times.
 */
export function change(
  current: number | null,
  previous: number | null,
  higherIsBetter = true,
): Change | null {
  if (current === null || previous === null) return null;
  const diff = Math.round((current - previous) * 10) / 10;
  if (diff === 0) return { diff, tone: 'same' };
  return { diff, tone: diff > 0 === higherIsBetter ? 'good' : 'bad' };
}

/** "+3 so với kỳ trước", "−1,5 giờ so với kỳ trước", "Bằng kỳ trước". */
export function changeText(c: Change, unit = ''): string {
  if (c.diff === 0) return 'Bằng kỳ trước';
  const sign = c.diff > 0 ? '+' : '−';
  const value = Math.abs(c.diff).toLocaleString('vi-VN');
  return `${sign}${value}${unit ? ` ${unit}` : ''} so với kỳ trước`;
}

/**
 * Round tick values for a count axis from 0: steps of 1, 2 or 5 × 10ⁿ (never below 1, counts
 * are whole people), about `target` steps, the last tick ≥ max. All zero → [0, 1].
 */
export function niceTicks(max: number, target = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / target;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(
    1,
    [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw)!,
  );
  const ticks: number[] = [];
  for (let t = 0; t < max + step; t += step) ticks.push(t);
  return ticks;
}

/** Where a chain of counts loses the most people: the step's index, before → after. */
export interface Drop {
  index: number;
  before: number;
  after: number;
  lost: number;
}

/**
 * The step that loses the most people, comparing each count with the one before it (the
 * first with `start`, e.g. the enrolled learners). Ties: the earliest. Null when no step
 * loses anyone.
 */
export function biggestDrop(counts: number[], start: number): Drop | null {
  let best: Drop | null = null;
  for (let index = 0; index < counts.length; index++) {
    const before = index === 0 ? start : counts[index - 1];
    const after = counts[index];
    const lost = before - after;
    if (lost > 0 && (!best || lost > best.lost)) best = { index, before, after, lost };
  }
  return best;
}

/** An item "loses many" when fewer than this share of the item before it got it done… */
export const HIGH_DROP_KEEP = 0.7;
/** …and at least this many people did the item before (3 → 1 is noise, not a pattern). */
export const HIGH_DROP_MIN = 3;

interface FunnelItemLike {
  kind: 'lesson' | 'exercise';
  id: string;
  title: string;
  completed: number;
}

/** A lesson or exercise of the detail list, against the item just before it. */
export interface ItemStep extends FunnelItemLike {
  /** the item before it in reading order (across chapters); `enrolled` for the first item */
  previous: number;
  /** completed / previous as a whole percent; null when previous is 0 */
  keptPercent: number | null;
  /** see HIGH_DROP_KEEP and HIGH_DROP_MIN */
  highDrop: boolean;
}

/**
 * Every item of every chapter against the item before it, in reading order (the first item
 * against the enrolled learners), grouped by chapter again.
 */
export function itemSteps<M extends { items: FunnelItemLike[] }>(
  modules: M[],
  enrolled: number,
): (Omit<M, 'items'> & { items: ItemStep[] })[] {
  let previous = enrolled;
  return modules.map((m) => ({
    ...m,
    items: m.items.map((item) => {
      const step: ItemStep = {
        ...item,
        previous,
        keptPercent: previous === 0 ? null : Math.round((item.completed / previous) * 100),
        highDrop: previous >= HIGH_DROP_MIN && item.completed < previous * HIGH_DROP_KEEP,
      };
      previous = item.completed;
      return step;
    }),
  }));
}

/** "0–25%", …, "100%" for a bucket of the progress histogram. */
export function bucketLabel(bucket: { from: number; to: number }): string {
  return bucket.from === bucket.to ? `${bucket.to}%` : `${bucket.from}–${bucket.to}%`;
}

/** "23/11 – 29/11": Monday → Sunday of a week in the weekly chart. */
export function weekRange(weekStart: string): string {
  const monday = Date.parse(`${weekStart}T00:00:00Z`);
  const sunday = new Date(monday + 6 * DAY_MS).toISOString().slice(0, 10);
  return `${weekLabel(weekStart)} – ${weekLabel(sunday)}`;
}
