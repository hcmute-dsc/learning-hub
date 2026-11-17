import type { ActivityDay, Role } from '@hub/shared';

/** Pure helpers for the member profile page (tested in profile.test.ts). */

export const ROLE_LABEL: Record<Role, string> = {
  member: 'Thành viên',
  mentor: 'Mentor',
  content_maintainer: 'Biên tập nội dung',
  admin: 'Ban chủ nhiệm',
};

/** Roles worth a badge: every member has "member", so it only shows when it is the only role. */
export function visibleRoles(roles: Role[]): Role[] {
  const extra = roles.filter((r) => r !== 'member');
  return extra.length ? extra : roles;
}

/** 0–4 shade for one day of the activity grid, like GitHub's contribution graph. */
export function activityLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

/**
 * Days grouped into weeks (Monday first) for the grid columns. The API starts the list
 * on a Monday; the last week may be shorter because days after today are left out.
 */
export function toWeeks(days: ActivityDay[]): ActivityDay[][] {
  const weeks: ActivityDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

/** "2026-11-17" → "17/11/2026" (dates from the API are already Vietnam days). */
export function formatDay(day: string): string {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}

/** ISO date-time → "tháng 11/2026", for "Tham gia tháng 11/2026". */
export function formatMonth(iso: string): string {
  const parts = new Intl.DateTimeFormat('vi-VN', {
    month: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).formatToParts(new Date(iso));
  const month = parts.find((p) => p.type === 'month')?.value;
  const year = parts.find((p) => p.type === 'year')?.value;
  return `tháng ${month}/${year}`;
}
