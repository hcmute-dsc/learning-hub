import type { Me } from '@hub/shared';
import { adminHomeFor } from '@/components/admin/admin-tabs';

/**
 * What the top bar shows for each person (INFORMATION-ARCHITECTURE §1, learning-hub#97).
 * Pure functions, tested in nav.test.ts, so the role rules live in one place.
 *
 * - Main links: at most 4, the same order on every page.
 * - Account menu (avatar): profile, settings, admin area, sign out.
 * - On phones the main links move into the account menu too (SiteHeader decides with CSS).
 *
 * Hiding a link is only convenience: every page and the API check roles again.
 */

export interface NavItem {
  href: string;
  label: string;
  /** emoji before the label in the account menu (the top bar shows text only) */
  icon?: string;
}

/** Main links for people who are signed in. */
const MEMBER_LINKS: NavItem[] = [
  { href: '/dashboard', label: 'Bảng điều khiển', icon: '🏠' },
  { href: '/tracks', label: 'Lộ trình', icon: '🧭' },
  { href: '/leaderboard', label: 'Xếp hạng', icon: '🏆' },
];

/** Mentor review queue (E7). */
export const REVIEW_LINK: NavItem = { href: '/review', label: 'Review', icon: '📝' };

/** Mentors and admins review project submissions (the API also lets admin pass). */
export function canReview(me: Me | null): boolean {
  return !!me && (me.roles.includes('admin') || me.roles.includes('mentor'));
}

/**
 * Main links in the top bar: members 3, mentors and admins 4 (with Review).
 * Guests get none: every page behind them asks to sign in, so the bar shows only
 * the "Đăng nhập" button.
 */
export function mainLinksFor(me: Me | null): NavItem[] {
  if (!me) return [];
  return canReview(me) ? [...MEMBER_LINKS, REVIEW_LINK] : MEMBER_LINKS;
}

/**
 * The account menu, top to bottom. "Quản trị" opens the first admin tab this person
 * may use (mentors → Thành viên, content maintainers → Nội dung, admins → Tổng quan).
 * Sign out is not listed: it is a form button, always last.
 */
export function accountLinksFor(me: Me): NavItem[] {
  const adminHref = adminHomeFor(me.roles);
  return [
    { href: `/u/${me.githubLogin}`, label: 'Hồ sơ của tôi', icon: '👤' },
    { href: '/settings', label: 'Cài đặt', icon: '⚙️' },
    ...(adminHref ? [{ href: adminHref, label: 'Quản trị', icon: '🛠️' }] : []),
  ];
}

/** Same rule as NavLink: the section and every page under it (/tracks/sql → Lộ trình). */
export function isActivePath(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
