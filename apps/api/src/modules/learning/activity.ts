import type { ActivityDay } from '@hub/shared';

/**
 * Learning activity on the member profile: which days a member learned something,
 * and streaks. Pure functions (tested in activity.spec.ts); days are Vietnam days, so
 * a lesson finished at 23:30 in Ho Chi Minh City counts for that day, not the next.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
/** Vietnam has no daylight saving time: always UTC+7. */
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

/** "YYYY-MM-DD" of the Vietnam day that contains this moment. */
export function vietnamDay(at: Date): string {
  return new Date(at.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);
}

function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Number of actions per Vietnam day. */
export function countByDay(moments: Date[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const at of moments) {
    const day = vietnamDay(at);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return counts;
}

/**
 * The last `weeks` full weeks ending with the week of `today` (weeks start on Monday,
 * as in Vietnam), oldest day first, zeros included, so the web can draw a grid.
 * Days after today are left out.
 */
export function activityGrid(
  counts: Map<string, number>,
  today: string,
  weeks: number,
): ActivityDay[] {
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const first = addDays(today, -weekday - (weeks - 1) * 7);
  const days: ActivityDay[] = [];
  for (let day = first; day <= today; day = addDays(day, 1)) {
    days.push({ date: day, count: counts.get(day) ?? 0 });
  }
  return days;
}

/**
 * How far apart two active days can be and still be in the same streak: 2 means one
 * missed day in between is forgiven (PRD F12, "không phạt nặng"). Two missed days in a
 * row end the streak.
 */
export const STREAK_MAX_GAP_DAYS = 2;

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/**
 * Streaks over Vietnam days (PRD F12). A run is a list of active days where each day is
 * at most STREAK_MAX_GAP_DAYS after the one before, so one missed day never breaks it.
 * Its length is the number of active days, not calendar days.
 *
 * Current streak: the latest run, while it can still continue. It is alive when the
 * last active day is today, yesterday, or the day before yesterday (yesterday was the
 * one forgiven day, so learning today keeps the run going). Otherwise it is 0.
 * Longest streak: the longest run ever. Days after today are ignored.
 */
export function streaks(
  activeDays: Iterable<string>,
  today: string,
): { current: number; longest: number } {
  const days = [...new Set(activeDays)].filter((day) => day <= today).sort();
  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of days) {
    const continues = previous !== null && daysBetween(previous, day) <= STREAK_MAX_GAP_DAYS;
    run = continues ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }

  const last = days.at(-1);
  const alive = last !== undefined && daysBetween(last, today) <= STREAK_MAX_GAP_DAYS;
  return { current: alive ? run : 0, longest };
}
