import { REPORT_MAX_DAYS } from '@hub/shared';

/**
 * The period of a progress report: whole days in Vietnam time (UTC+7, no DST), both ends
 * included, like the weekly trial numbers (TRIAL-P0 §4.1). Pure functions, tested in
 * period.spec.ts.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

export interface ReportPeriod {
  /** "YYYY-MM-DD", first day */
  from: string;
  /** "YYYY-MM-DD", last day (included) */
  to: string;
  startsAt: Date;
  /** exclusive: 00:00 of the day after `to` */
  endsAt: Date;
}

/** "YYYY-MM-DD" of the Vietnam day that contains this moment. */
export function vietnamDay(at: Date): string {
  return new Date(at.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD HH:mm" in Vietnam time (for CSV cells). */
export function vietnamDateTime(at: Date): string {
  return new Date(at.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 16).replace('T', ' ');
}

/** 00:00 Vietnam time of this day, or null for a day that does not exist (2026-02-30). */
export function dayStart(day: string): Date | null {
  const utcMidnight = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(utcMidnight)) return null;
  if (new Date(utcMidnight).toISOString().slice(0, 10) !== day) return null;
  return new Date(utcMidnight - VIETNAM_OFFSET_MS);
}

/** Monday of the Vietnam week that contains this moment, "YYYY-MM-DD". */
export function mondayOf(at: Date): string {
  const today = vietnamDay(at);
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  return vietnamDay(new Date(dayStart(today)!.getTime() - weekday * DAY_MS));
}

/**
 * The period asked for. Defaults: from Monday of this week to today. Null when a day does
 * not exist, `from` is after `to`, or the period is longer than REPORT_MAX_DAYS.
 */
export function resolvePeriod(
  query: { from?: string; to?: string },
  now: Date,
): ReportPeriod | null {
  const from = query.from ?? mondayOf(now);
  const to = query.to ?? vietnamDay(now);
  const startsAt = dayStart(from);
  const lastDay = dayStart(to);
  if (!startsAt || !lastDay || lastDay < startsAt) return null;
  const endsAt = new Date(lastDay.getTime() + DAY_MS);
  if ((endsAt.getTime() - startsAt.getTime()) / DAY_MS > REPORT_MAX_DAYS) return null;
  return { from, to, startsAt, endsAt };
}
