import {
  REPORT_DATE_PATTERN,
  REPORT_NO_COHORT,
  TRACK_SLUG_PATTERN,
  type ReportQuery,
} from '@hub/shared';

/** Pure helpers for /admin/reports (tested in report-format.test.ts). */

const DAY_MS = 24 * 60 * 60 * 1000;
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

/**
 * The filters in the page URL, keeping only well-formed ones (same rules as the API), so a
 * hand-edited link falls back to the default instead of an error page.
 */
export function reportQueryFromParams(params: SearchParams): ReportQuery {
  const from = one(params.from);
  const to = one(params.to);
  const track = one(params.track);
  const cohort = one(params.cohort);
  return {
    ...(from && REPORT_DATE_PATTERN.test(from) ? { from } : {}),
    ...(to && REPORT_DATE_PATTERN.test(to) ? { to } : {}),
    ...(track && TRACK_SLUG_PATTERN.test(track) && track.length <= 80 ? { track } : {}),
    ...(cohort && cohort.length <= 40 ? { cohort } : {}),
  };
}

/** "?from=…&to=…" for the API or a link; empty values are left out. */
export function reportSearch(query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
  const text = params.toString();
  return text ? `?${text}` : '';
}

/** "YYYY-MM-DD" of the Vietnam day that contains this moment. */
export function vietnamDay(at: Date): string {
  return new Date(at.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);
}

function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

export interface ReportPreset {
  label: string;
  from: string;
  to: string;
}

/**
 * Quick periods above the date fields. Weeks run Monday → Sunday like the weekly trial
 * numbers (TRIAL-P0 §4.1); "Tuần trước" is the one to copy into the Monday report.
 */
export function reportPresets(now: Date): ReportPreset[] {
  const today = vietnamDay(now);
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const monday = addDays(today, -weekday);
  return [
    { label: 'Tuần này', from: monday, to: today },
    { label: 'Tuần trước', from: addDays(monday, -7), to: addDays(monday, -1) },
    { label: '30 ngày qua', from: addDays(today, -29), to: today },
    { label: 'Tháng này', from: `${today.slice(0, 8)}01`, to: today },
  ];
}

export function cohortLabel(cohort: string | null): string {
  return cohort ?? 'Chưa gắn đợt';
}

/** Options of the "Đợt" menu: every label, then the enrollments without one. */
export function cohortOptions(cohorts: string[]): { value: string; label: string }[] {
  return [
    ...cohorts.map((c) => ({ value: c, label: c })),
    { value: REPORT_NO_COHORT, label: cohortLabel(null) },
  ];
}

/** 12.5 → "12,5 giờ"; null (no review in the period) → "—". */
export function formatHours(hours: number | null): string {
  return hours === null ? '—' : `${hours.toLocaleString('vi-VN')} giờ`;
}

/** "23/11/2026" from "2026-11-23". */
export function formatDay(day: string): string {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}
