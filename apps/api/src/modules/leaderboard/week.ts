import { WEEK_ID_PATTERN } from '@hub/shared';

/**
 * ISO weeks in Vietnam time (Monday 00:00 → next Monday 00:00, UTC+7, no DST), for the
 * weekly leaderboard view (learning-hub#88) and the Monday Discord post (#76), so both
 * always mean the same seven days. Pure functions, tested in week.spec.ts.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

export interface Week {
  /** ISO week, e.g. "2026-W47" */
  id: string;
  startsAt: Date;
  /** exclusive */
  endsAt: Date;
}

/** ISO 8601 week id ("YYYY-Www") of the Vietnam day that contains this moment. */
export function isoWeekId(at: Date): string {
  const local = new Date(at.getTime() + VIETNAM_OFFSET_MS);
  const day = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
  const weekday = (day.getUTCDay() + 6) % 7; // Monday = 0
  // The Thursday of this week decides the ISO year.
  const thursday = new Date(day.getTime() + (3 - weekday) * DAY_MS);
  const year = thursday.getUTCFullYear();
  const week = Math.floor((thursday.getTime() - week1Monday(year)) / (7 * DAY_MS)) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** Monday of ISO week 1 of `year`, at 00:00 UTC (as a "local date" number). */
function week1Monday(year: number): number {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  return jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * DAY_MS;
}

/** The week that contains this moment. */
export function weekAt(at: Date): Week {
  const local = new Date(at.getTime() + VIETNAM_OFFSET_MS);
  const weekday = (local.getUTCDay() + 6) % 7;
  const mondayLocal =
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - weekday * DAY_MS;
  return fromMondayLocal(mondayLocal);
}

/** The week with this id, or null for a malformed id or a week the year does not have (W53). */
export function weekById(id: string): Week | null {
  if (!WEEK_ID_PATTERN.test(id)) return null;
  const [year, n] = id.split('-W').map(Number);
  if (n < 1) return null;
  const week = fromMondayLocal(week1Monday(year) + (n - 1) * 7 * DAY_MS);
  // W53 of a 52-week year lands in W01 of the next year: not a real id.
  return week.id === id ? week : null;
}

function weekNo(id: string): number {
  return Number(id.split('-W')[1]);
}

function fromMondayLocal(mondayLocal: number): Week {
  const startsAt = new Date(mondayLocal - VIETNAM_OFFSET_MS);
  const endsAt = new Date(startsAt.getTime() + 7 * DAY_MS);
  return { id: isoWeekId(startsAt), startsAt, endsAt };
}

/** The week before / after this one (across years). */
export function shiftWeek(week: Week, by: number): Week {
  return weekAt(new Date(week.startsAt.getTime() + by * 7 * DAY_MS));
}

/** "Tuần 47 (16/11 – 22/11/2026)": the days in Vietnam time, end day included. */
export function weekLabel(week: Week): string {
  const day = (d: Date) => new Date(d.getTime() + VIETNAM_OFFSET_MS);
  const first = day(week.startsAt);
  const last = day(new Date(week.endsAt.getTime() - DAY_MS));
  const dm = (d: Date) => `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
  return `Tuần ${weekNo(week.id)} (${dm(first)} – ${dm(last)}/${last.getUTCFullYear()})`;
}

/**
 * The week a member asked for: the current one when none is given. Weeks that have not
 * started yet are refused (null), like malformed ids.
 */
export function resolveWeek(id: string | undefined, now: Date): Week | null {
  const current = weekAt(now);
  if (!id) return current;
  const week = weekById(id);
  if (!week || week.startsAt > current.startsAt) return null;
  return week;
}
