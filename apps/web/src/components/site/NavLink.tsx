'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { isActivePath } from './nav';

/**
 * Header link that shows where you are: an orange underline on the current section
 * (e.g. /tracks and every /tracks/... page). Client component only for usePathname.
 */
export function NavLink({
  href,
  className = '',
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = isActivePath(href, pathname);
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`relative whitespace-nowrap py-1 font-medium transition-colors hover:text-brand-600 ${
        active ? 'text-brand-600' : ''
      } ${className}`}
    >
      {children}
      <span
        aria-hidden
        className={`absolute inset-x-0 -bottom-[11px] h-0.5 rounded-full bg-brand-500 transition-transform duration-200 ${
          active ? 'scale-x-100' : 'scale-x-0'
        }`}
      />
    </Link>
  );
}
