'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { Me } from '@hub/shared';
import { Avatar } from '@/components/ui/Avatar';
import { nextMenuIndex, openingFocus } from './menu-keys';
import { REVIEW_LINK, isActivePath, type NavItem } from './nav';
import { ReviewCount } from './ReviewCount';

const ITEM =
  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--bg)] focus-visible:bg-[var(--bg)] focus-visible:outline-none aria-[current=page]:font-semibold aria-[current=page]:text-brand-600';

/**
 * The avatar button on the right of the top bar (learning-hub#97). One menu for the
 * account: profile, settings, the admin area, sign out. On phones (below md) it also
 * holds the main links, which the bar hides there.
 *
 * Accessible "menu button" (WAI-ARIA APG): Enter/Space/↓ open it on the first item,
 * ↑ on the last, ↓/↑/Home/End move (menu-keys.ts), Esc closes and gives focus back
 * to the button, Tab or a click outside closes it.
 */
export function UserMenu({
  me,
  mainLinks,
  accountLinks,
}: {
  me: Me;
  mainLinks: NavItem[];
  accountLinks: NavItem[];
}) {
  const [open, setOpen] = useState(false);
  const focusOnOpen = useRef<'first' | 'last'>('first');
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonId = useId();
  const menuId = useId();
  const pathname = usePathname();

  // Items hidden by CSS (the main links on wide screens) are skipped by the arrow keys.
  const items = () =>
    Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []).filter(
      (el) => el.offsetParent !== null,
    );

  // A new page closes the menu.
  useEffect(() => setOpen(false), [pathname]);

  // Focus moves into the menu when it opens.
  useEffect(() => {
    if (!open) return;
    const list = items();
    (focusOnOpen.current === 'last' ? list.at(-1) : list[0])?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  function toggle() {
    focusOnOpen.current = 'first';
    setOpen((o) => !o);
  }

  function onButtonKeyDown(e: KeyboardEvent) {
    const where = openingFocus(e.key);
    if (!where) return;
    e.preventDefault();
    focusOnOpen.current = where;
    setOpen(true);
  }

  function onMenuKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
      return;
    }
    if (e.key === 'Tab') {
      setOpen(false);
      return;
    }
    const list = items();
    const next = nextMenuIndex(
      e.key,
      list.indexOf(document.activeElement as HTMLElement),
      list.length,
    );
    if (next === null) return;
    e.preventDefault();
    list[next].focus();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        onClick={toggle}
        onKeyDown={onButtonKeyDown}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Tài khoản @${me.githubLogin}`}
        className="flex items-center gap-2 rounded-full border border-transparent py-0.5 pr-2 pl-0.5 hover:border-[var(--border)] aria-expanded:border-[var(--border)]"
      >
        <Avatar src={me.avatarUrl} size={28} />
        <span className="hidden max-w-[10rem] truncate lg:inline">@{me.githubLogin}</span>
        <span aria-hidden className="muted text-xs md:hidden">
          ☰
        </span>
        <span aria-hidden className="muted hidden text-xs md:inline">
          ▾
        </span>
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-labelledby={buttonId}
          onKeyDown={onMenuKeyDown}
          className="surface absolute right-0 z-30 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl p-1.5 shadow-lg"
        >
          <div role="none" className="border-b border-[var(--border)] px-3 pt-1.5 pb-2.5">
            <p className="truncate font-semibold">{me.displayName}</p>
            <p className="muted truncate text-xs">@{me.githubLogin}</p>
          </div>

          {mainLinks.length > 0 && (
            <div
              role="group"
              aria-label="Điều hướng"
              className="border-b border-[var(--border)] py-1 md:hidden"
            >
              {mainLinks.map((item) => (
                <MenuLink key={item.href} item={item} pathname={pathname}>
                  {item.href === REVIEW_LINK.href && <ReviewCount />}
                </MenuLink>
              ))}
            </div>
          )}

          <div role="group" aria-label="Tài khoản" className="py-1">
            {accountLinks.map((item) => (
              <MenuLink key={item.href} item={item} pathname={pathname} />
            ))}
          </div>

          <form
            action="/logout"
            method="post"
            role="none"
            className="border-t border-[var(--border)] pt-1"
          >
            <button type="submit" role="menuitem" tabIndex={-1} className={ITEM}>
              <span aria-hidden className="w-5 text-center">
                ↪
              </span>
              Đăng xuất
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  item,
  pathname,
  children,
}: {
  item: NavItem;
  pathname: string;
  children?: ReactNode;
}) {
  return (
    <Link
      href={item.href}
      role="menuitem"
      tabIndex={-1}
      aria-current={isActivePath(item.href, pathname) ? 'page' : undefined}
      className={ITEM}
    >
      {item.icon && (
        <span aria-hidden className="w-5 text-center">
          {item.icon}
        </span>
      )}
      <span className="flex-1">{item.label}</span>
      {children}
    </Link>
  );
}
