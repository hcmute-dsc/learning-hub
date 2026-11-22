import type { Role } from '@hub/shared';

/** Pure helpers for the admin area navigation (tested in admin-tabs.test.ts). */

export interface AdminTab {
  href: string;
  label: string;
  /** who may open it besides admin (admin passes every check, like the API) */
  roles: Role[];
  /** active only on this exact path (the overview at /admin is a prefix of every tab) */
  exact?: boolean;
}

/** The order is the order of the tabs; the first one a person may open is their "home". */
export const ADMIN_TABS: AdminTab[] = [
  { href: '/admin', label: 'Tổng quan', roles: [], exact: true },
  { href: '/admin/members', label: 'Thành viên', roles: ['mentor'] },
  { href: '/admin/content', label: 'Nội dung', roles: ['content_maintainer'] },
  { href: '/admin/certificates', label: 'Chứng nhận', roles: [] },
  { href: '/admin/leaderboard', label: 'Bảng xếp hạng', roles: [] },
  { href: '/admin/reports', label: 'Báo cáo', roles: [] },
  { href: '/admin/audit', label: 'Nhật ký', roles: [] },
];

export function adminTabsFor(roles: Role[]): AdminTab[] {
  if (roles.includes('admin')) return ADMIN_TABS;
  return ADMIN_TABS.filter((tab) => tab.roles.some((r) => roles.includes(r)));
}

/** Where the header's "Quản trị" link goes, or null when the person has no admin tab. */
export function adminHomeFor(roles: Role[]): string | null {
  return adminTabsFor(roles)[0]?.href ?? null;
}

/** The tab for this path (/admin/content/versions/x → "Nội dung"), for the active state. */
export function isTabActive(tab: AdminTab, pathname: string): boolean {
  if (pathname === tab.href) return true;
  return !tab.exact && pathname.startsWith(`${tab.href}/`);
}
