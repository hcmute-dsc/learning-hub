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
 * Current streak: consecutive active days ending today, or ending yesterday when the
 * member has not learned yet today (the streak is not lost until the day is over).
 * Longest streak: the longest run of consecutive active days ever.
 */
export function streaks(
  activeDays: Iterable<string>,
  today: string,
): { current: number; longest: number } {
  const days = new Set(activeDays);
  let longest = 0;
  for (const day of days) {
    if (days.has(addDays(day, -1))) continue; // not the start of a run
    let length = 1;
    while (days.has(addDays(day, length))) length++;
    longest = Math.max(longest, length);
  }

  let end = days.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (days.has(end)) {
    current++;
    end = addDays(end, -1);
  }
  return { current, longest };
}
