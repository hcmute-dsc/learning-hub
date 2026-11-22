'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { centeredScrollLeft, isTabActive, type AdminTab } from './admin-tabs';
import { TAB_STRIP, tabLinkClass } from '@/components/ui/tab-strip';

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
      <ul ref={stripRef} className={TAB_STRIP}>
        {tabs.map((tab) => {
          const active = isTabActive(tab, pathname);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={tabLinkClass(active)}
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
