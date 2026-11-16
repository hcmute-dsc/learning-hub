import Link from 'next/link';
import type { Me } from '@hub/shared';
import { BrandLogo } from './BrandLogo';
import { NavLink } from './NavLink';

// `phone: false` hides a link on small screens to keep the bar on one line;
// the dashboard is still where sign-in lands, so phones lose nothing.
const NAV = [
  { href: '/dashboard', label: 'Bảng điều khiển', phone: false },
  { href: '/tracks', label: 'Lộ trình', phone: true },
];

/** Only for people who can approve accounts; the page and API check roles again. */
const ADMIN_LINK = { href: '/admin/members', label: 'Quản trị', phone: false };

const canManageMembers = (me: Me | null) =>
  !!me && (me.roles.includes('admin') || me.roles.includes('mentor'));

/** Top bar in the style of the club website: white bar, DSC mark, dark links with orange hover. */
export function SiteHeader({ me }: { me: Me | null }) {
  const links = canManageMembers(me) ? [...NAV, ADMIN_LINK] : NAV;
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
        <div className="ml-auto flex items-center gap-3">
          {me ? (
            <>
              <span className="muted hidden sm:inline">@{me.githubLogin}</span>
              <form action="/logout" method="post">
                <button className="rounded-md border border-[var(--border)] px-3 py-1.5 hover:border-brand-500">
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
