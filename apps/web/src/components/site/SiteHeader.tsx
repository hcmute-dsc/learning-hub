import Link from 'next/link';
import type { Me } from '@hub/shared';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { BrandLogo } from './BrandLogo';
import { NavLink } from './NavLink';
import { ReviewCount } from './ReviewCount';
import { UserMenu } from './UserMenu';
import { REVIEW_LINK, accountLinksFor, mainLinksFor } from './nav';

/**
 * Top bar (INFORMATION-ARCHITECTURE §1, learning-hub#97), three parts:
 *
 *   [DSC logo → home]  main links (≤ 4)          [🔔] [avatar ▾ account menu]
 *
 * Which links each role gets is decided in nav.ts (guests: none, only "Đăng nhập").
 * Below md the main links move into the account menu, so the bar never wraps or scrolls.
 */
export function SiteHeader({ me }: { me: Me | null }) {
  const mainLinks = mainLinksFor(me);
  return (
    <header className="surface sticky top-0 z-20 border-x-0 border-t-0 shadow-sm">
      <nav
        aria-label="Chính"
        className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2.5 text-sm md:gap-6"
      >
        <Link href="/" className="shrink-0" aria-label="DSC Learning Hub — trang chủ">
          <BrandLogo height={30} />
        </Link>

        {mainLinks.length > 0 && (
          <ul className="hidden items-center gap-5 md:flex">
            {mainLinks.map((item) => (
              <li key={item.href}>
                <NavLink href={item.href}>
                  {item.label}
                  {item.href === REVIEW_LINK.href && <ReviewCount />}
                </NavLink>
              </li>
            ))}
          </ul>
        )}

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {me ? (
            <>
              {/* pending accounts have nothing to read yet and the API would refuse them */}
              {me.status === 'active' && <NotificationBell />}
              <UserMenu me={me} mainLinks={mainLinks} accountLinks={accountLinksFor(me)} />
            </>
          ) : (
            <Link
              href="/login"
              className="press rounded-md bg-brand-600 px-3 py-1.5 font-medium whitespace-nowrap text-white hover:bg-brand-700"
            >
              Đăng nhập
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
