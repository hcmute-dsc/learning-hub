import Link from 'next/link';
import type { ReviewQueue } from '@hub/shared';
import { isFiltered, type QueueFilter } from './queue-filter';

const FIELD = 'rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm';

/**
 * Track / mentee filter for the review queue. A plain GET form: the filter lives in the
 * URL (`?track=&mentee=`), survives a reload, can be shared, and works without
 * JavaScript. The mentee choice is shown only to mentors who have mentees (E8).
 */
export function QueueFilterForm({
  filter,
  options,
}: {
  filter: QueueFilter;
  options: ReviewQueue['options'];
}) {
  return (
    <form method="get" className="flex flex-wrap items-center gap-2" aria-label="Lọc hàng đợi">
      <label htmlFor="track" className="text-sm font-medium">
        Track
      </label>
      <select id="track" name="track" defaultValue={filter.track ?? ''} className={FIELD}>
        <option value="">Tất cả</option>
        {options.tracks.map((t) => (
          <option key={t.slug} value={t.slug}>
            {t.title}
          </option>
        ))}
      </select>

      {options.mentees.length > 0 && (
        <>
          <label htmlFor="mentee" className="ml-2 text-sm font-medium">
            Mentee
          </label>
          <select id="mentee" name="mentee" defaultValue={filter.mentee ?? ''} className={FIELD}>
            <option value="">Tất cả</option>
            {options.mentees.map((m) => (
              <option key={m.id} value={m.githubLogin}>
                {m.displayName} (@{m.githubLogin})
              </option>
            ))}
          </select>
        </>
      )}

      <button className="press rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:border-brand-500">
        Lọc
      </button>
      {isFiltered(filter) && (
        <Link href="/review" className="muted text-sm underline-offset-2 hover:underline">
          Bỏ lọc
        </Link>
      )}
    </form>
  );
}
