import Link from 'next/link';
import type { TrackTab } from './track-docs';

/**
 * "Tổng quan | Cài đặt | Tài liệu thêm" under the track header, styled like AdminTabs.
 * Renders nothing when `trackTabs` gave no tabs (the track has no extra pages).
 */
export function TrackTabs({ tabs }: { tabs: TrackTab[] }) {
  if (tabs.length === 0) return null;
  return (
    <nav aria-label="Trang của lộ trình" className="border-b border-[var(--border)]">
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Link
              href={tab.href}
              aria-current={tab.current ? 'page' : undefined}
              className={`block border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                tab.current
                  ? 'border-brand-500 text-brand-600'
                  : 'muted border-transparent hover:text-brand-600'
              }`}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
