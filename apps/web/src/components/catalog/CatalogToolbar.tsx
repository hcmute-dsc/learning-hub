import type { CSSProperties } from 'react';
import { TRACK_LEVELS } from '@hub/shared';
import { LEVEL_LABEL } from '@/lib/labels';
import type { CatalogFilters } from './catalog';

const FIELD =
  'rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 focus:border-brand-500';

/**
 * Search, level and tag filters as a plain GET form: the filters live in the URL
 * (`?q=&level=&tag=a&tag=b`), so results are shareable and the page works without
 * JavaScript. Tags are checkboxes named `tag`, so each checked one adds a `tag=`.
 */
export function CatalogToolbar({
  filters,
  tags,
  total,
}: {
  filters: CatalogFilters;
  /** Every tag used by a published track (GET /tracks/tags). */
  tags: string[];
  total: number;
}) {
  return (
    <form
      role="search"
      className="surface motion-fade-up rounded-2xl p-3 shadow-sm"
      style={{ '--i': 1 } as CSSProperties}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
      </div>
      {tags.length > 0 && <TagChoices tags={tags} selected={filters.tags} />}
    </form>
  );
}

/** Tag checkboxes styled as chips; "Lọc" submits them with the search and level. */
function TagChoices({ tags, selected }: { tags: string[]; selected: string[] }) {
  return (
    <fieldset className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--border)] pt-3">
      <legend className="sr-only">Chủ đề</legend>
      <span aria-hidden className="muted mr-1 text-sm">
        Chủ đề:
      </span>
      {tags.map((tag) => (
        <label key={tag} className="cursor-pointer">
          <input
            type="checkbox"
            name="tag"
            value={tag}
            defaultChecked={selected.includes(tag)}
            className="peer sr-only"
          />
          <span className="block rounded-full border border-[var(--border)] px-2.5 py-0.5 text-xs peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500">
            {tag}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
