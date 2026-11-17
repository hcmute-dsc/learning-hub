'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isTabActive, type AdminTab } from './admin-tabs';

/** Sub-navigation of the admin area. Client component only for usePathname. */
export function AdminTabs({ tabs }: { tabs: AdminTab[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Quản trị" className="border-b border-[var(--border)]">
      <ul className="-mb-px flex gap-1 overflow-x-auto">
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
