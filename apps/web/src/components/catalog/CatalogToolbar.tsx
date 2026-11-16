import type { CSSProperties } from 'react';
import { TRACK_LEVELS } from '@hub/shared';
import { LEVEL_LABEL } from '@/lib/labels';
import type { CatalogFilters } from './catalog';

const FIELD =
  'rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 focus:border-brand-500';

/**
 * Search + level filter as a plain GET form: the filters live in the URL, so results
 * are shareable and the page works without JavaScript.
 */
export function CatalogToolbar({ filters, total }: { filters: CatalogFilters; total: number }) {
  return (
    <form
      role="search"
      className="surface motion-fade-up flex flex-col gap-3 rounded-2xl p-3 shadow-sm sm:flex-row sm:items-center"
      style={{ '--i': 1 } as CSSProperties}
    >
      <label className="sr-only" htmlFor="q">
        Tìm lộ trình
      </label>
      <div className="relative flex-1">
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm"
        >
          🔍
        </span>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={filters.q}
          placeholder="Tìm lộ trình…"
          className={`${FIELD} w-full pl-9`}
        />
      </div>
      <label className="sr-only" htmlFor="level">
        Trình độ
      </label>
      <select id="level" name="level" defaultValue={filters.level ?? ''} className={FIELD}>
        <option value="">Mọi trình độ</option>
        {TRACK_LEVELS.map((level) => (
          <option key={level} value={level}>
            {LEVEL_LABEL[level]}
          </option>
        ))}
      </select>
      <button className="press rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700">
        Lọc
      </button>
      <p
        aria-live="polite"
        className="self-start rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700 sm:self-center"
      >
        {total} kết quả
      </p>
    </form>
  );
}
