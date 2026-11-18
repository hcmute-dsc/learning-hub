import Link from 'next/link';
import type { Me } from '@hub/shared';
import { adminHomeFor } from '@/components/admin/admin-tabs';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Avatar } from '@/components/ui/Avatar';
import { BrandLogo } from './BrandLogo';
import { NavLink } from './NavLink';

// `phone: false` hides a link on small screens to keep the bar on one line;
// the dashboard is still where sign-in lands, so phones lose nothing.
const NAV = [
  { href: '/dashboard', label: 'Bảng điều khiển', phone: false },
  { href: '/tracks', label: 'Lộ trình', phone: true },
];

/** Mentor review queue (E7): mentors and admins; the page and API check roles again. */
const REVIEW_LINK = { href: '/review', label: 'Review', phone: true };

const canReview = (me: Me | null) =>
  !!me && (me.roles.includes('admin') || me.roles.includes('mentor'));

/** Top bar in the style of the club website: white bar, DSC mark, dark links with orange hover. */
export function SiteHeader({ me }: { me: Me | null }) {
  // "Quản trị" opens the first admin tab this person may use; pages and API check again.
  const adminHref = me ? adminHomeFor(me.roles) : null;
  const links = [
    ...NAV,
    ...(canReview(me) ? [REVIEW_LINK] : []),
    ...(adminHref ? [{ href: adminHref, label: 'Quản trị', phone: false }] : []),
  ];
  return (
    <header className="surface sticky top-0 z-20 border-x-0 border-t-0 shadow-sm">
      <nav
        aria-label="Chính"
        className="mx-auto flex max-w-6xl items-center gap-5 px-4 py-2.5 text-sm"
      >
        <Link
          href="/"
          className="flex items-center gap-2.5"
          aria-label="DSC Learning Hub — trang chủ"
        >
          <BrandLogo height={30} />
          <span className="hidden border-l border-[var(--border)] pl-2.5 font-semibold sm:inline">
            Learning Hub
          </span>
        </Link>
        {links.map((n) => (
          <NavLink key={n.href} href={n.href} className={n.phone ? '' : 'hidden sm:inline'}>
            {n.label}
          </NavLink>
        ))}
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {me ? (
            <>
              <Link
                href={`/u/${me.githubLogin}`}
                className="flex items-center gap-2 rounded-full hover:text-brand-600"
                title="Hồ sơ của bạn"
              >
                <Avatar src={me.avatarUrl} size={28} />
                <span className="hidden sm:inline">@{me.githubLogin}</span>
              </Link>
              {/* pending accounts have nothing to read yet and the API would refuse them */}
              {me.status === 'active' && <NotificationBell />}
              <Link
                href="/settings"
                aria-label="Cài đặt"
                title="Cài đặt"
                className="rounded-md p-1.5 text-lg leading-none hover:bg-[var(--bg)]"
              >
                <span aria-hidden>⚙️</span>
              </Link>
              <form action="/logout" method="post">
                <button className="rounded-md border border-[var(--border)] px-3 py-1.5 whitespace-nowrap hover:border-brand-500">
                  Đăng xuất
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="press rounded-md bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700"
            >
              Đăng nhập
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
