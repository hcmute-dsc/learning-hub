'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { centeredScrollLeft, isTabActive, type AdminTab } from './admin-tabs';

/**
 * Sub-navigation of the admin area. On phones the tabs scroll sideways without a
 * scrollbar, the edges fade to show there is more, and the open tab is scrolled
 * into the middle (learning-hub#97). Client component for usePathname and the scroll.
 */
export function AdminTabs({ tabs }: { tabs: AdminTab[] }) {
  const pathname = usePathname();
  const stripRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const strip = stripRef.current;
    const active = strip?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!strip || !active || strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollLeft = centeredScrollLeft(active.offsetLeft, active.offsetWidth, strip.clientWidth);
  }, [pathname]);

  return (
    <nav aria-label="Quản trị" className="border-b border-[var(--border)]">
      <ul
        ref={stripRef}
        className="relative -mb-px flex gap-1 overflow-x-auto [scrollbar-width:none] max-sm:[mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-24px),transparent)] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => {
          const active = isTabActive(tab, pathname);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`block border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                  active
                    ? 'border-brand-500 text-brand-600'
                    : 'muted border-transparent hover:text-brand-600'
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
