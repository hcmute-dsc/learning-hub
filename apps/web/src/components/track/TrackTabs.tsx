import Link from 'next/link';
import type { TrackTab } from './track-docs';
import { TAB_STRIP, tabLinkClass } from '@/components/ui/tab-strip';

/**
 * "Tổng quan | Cài đặt | Tài liệu thêm" under the track header, styled like AdminTabs.
 * Renders nothing when `trackTabs` gave no tabs (the track has no extra pages).
 */
export function TrackTabs({ tabs }: { tabs: TrackTab[] }) {
  if (tabs.length === 0) return null;
  return (
    <nav aria-label="Trang của lộ trình" className="border-b border-[var(--border)]">
      <ul className={TAB_STRIP}>
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Link
              href={tab.href}
              aria-current={tab.current ? 'page' : undefined}
              className={tabLinkClass(tab.current)}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
