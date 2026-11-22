'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReviewQueueCount } from '@hub/shared';
import { badgeLabel } from '@/components/notifications/bell';
import { getJson } from '@/lib/client-api';

/**
 * Number of unclaimed submissions next to "Review" (mentors and admins only, the
 * API answers 403 to anyone else). Refreshed on every page change, like the bell.
 * The badge is hidden from screen readers; they hear "N bài đang chờ" instead.
 */
export function ReviewCount() {
  const [count, setCount] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    let live = true;
    void getJson<{ data: ReviewQueueCount }>('/reviews/queue/count').then((res) => {
      if (live && res.ok) setCount(res.data.data.unclaimed);
    });
    return () => {
      live = false;
    };
  }, [pathname]);

  const badge = badgeLabel(count);
  if (!badge) return null;
  return (
    <>
      <span
        aria-hidden
        className="ml-1.5 inline-block min-w-[1.1rem] rounded-full bg-brand-600 px-1 text-center text-[10px] leading-[1.1rem] font-semibold text-white"
      >
        {badge}
      </span>
      <span className="sr-only">, {count} bài đang chờ</span>
    </>
  );
}
