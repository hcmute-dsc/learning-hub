'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { LeaderboardRange } from '@hub/shared';
import { boardHref, type BoardQuery } from './board';

/**
 * Filters of /leaderboard (learning-hub#88): term or week, previous/next, and a track.
 * Every choice is a URL (boardHref), so a filtered board can be shared or reloaded.
 */
export function BoardFilters({
  query,
  range,
  tracks,
}: {
  query: BoardQuery;
  range: LeaderboardRange;
  tracks: { slug: string; title: string }[];
}) {
  const router = useRouter();
  const tab = (period: BoardQuery['period'], label: string) => (
    <Link
      href={boardHref(query, { period })}
      aria-current={query.period === period ? 'page' : undefined}
      className="lb-tab"
      scroll={false}
    >
      {label}
    </Link>
  );
  const unit = range.period === 'week' ? 'tuần' : 'kỳ';

  return (
    <div className="flex flex-wrap items-center gap-3">
      <nav aria-label="Khoảng thời gian" className="lb-tabs">
        {tab('term', 'Học kỳ')}
        {tab('week', 'Tuần')}
      </nav>

      <div className="flex items-center gap-1" aria-label={`Chọn ${unit}`}>
        <StepLink href={range.previousId ? boardHref(query, { id: range.previousId }) : null}>
          ‹<span className="sr-only">{`${unit} trước`}</span>
        </StepLink>
        <span className="min-w-0 px-2 text-sm font-medium">{range.label}</span>
        <StepLink href={range.nextId ? boardHref(query, { id: range.nextId }) : null}>
          ›<span className="sr-only">{`${unit} sau`}</span>
        </StepLink>
      </div>

      <label className="flex items-center gap-2 text-sm sm:ml-auto">
        <span className="muted">Lộ trình</span>
        <select
          value={query.track ?? ''}
          onChange={(e) =>
            router.push(boardHref(query, { track: e.target.value || undefined }), {
              scroll: false,
            })
          }
          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5"
        >
          <option value="">Tất cả lộ trình</option>
          {tracks.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.title}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function StepLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  const cls =
    'grid size-8 place-items-center rounded-md border border-[var(--border)] text-lg leading-none';
  if (!href) {
    return (
      <span aria-disabled className={`${cls} opacity-40`}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} scroll={false} className={`${cls} hover:border-brand-500`}>
      {children}
    </Link>
  );
}
