import { MAX_TAG_FILTERS, TRACK_LEVELS, type TrackLevel, type TrackProgress } from '@hub/shared';

/**
 * Pure helpers for the track catalog page (app/tracks/page.tsx), tested in catalog.test.ts.
 */

export interface CatalogFilters {
  q?: string;
  level?: TrackLevel;
  /** Selected tags; a track matches when it has any of them. Always set, maybe empty. */
  tags: string[];
}

/**
 * Reads ?q=&level=&tag= from the URL, dropping an empty search, an unknown level and
 * blank or repeated tags. `tag` repeats (`?tag=sql&tag=git`), so Next gives an array.
 */
export function parseFilters(params: {
  q?: string;
  level?: string;
  tag?: string | string[];
}): CatalogFilters {
  const q = params.q?.trim() || undefined;
  const level = (TRACK_LEVELS as readonly string[]).includes(params.level ?? '')
    ? (params.level as TrackLevel)
    : undefined;
  const rawTags = params.tag === undefined ? [] : [params.tag].flat();
  const tags = [...new Set(rawTags.map((tag) => tag.trim()).filter(Boolean))].slice(
    0,
    MAX_TAG_FILTERS,
  );
  return { q, level, tags };
}

/** Query string for both GET /tracks and the /tracks page URL. */
export function tracksQuery(filters: CatalogFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.level) params.set('level', filters.level);
  for (const tag of filters.tags) params.append('tag', tag);
  return params.toString();
}

/** True when any filter is set, so the page shows the filtered heading. */
export function hasFilters(filters: CatalogFilters): boolean {
  return Boolean(filters.q || filters.level || filters.tags.length);
}

/**
 * Link for a tag chip: adds the tag to the current filters, or removes it when it is
 * already selected. Search and level are kept, so filters combine.
 */
export function toggleTagHref(filters: CatalogFilters, tag: string): string {
  const tags = filters.tags.includes(tag)
    ? filters.tags.filter((t) => t !== tag)
    : [...filters.tags, tag];
  const query = tracksQuery({ ...filters, tags });
  return query ? `/tracks?${query}` : '/tracks';
}

/**
 * slug → percent for every track the member is enrolled in. A completed track maps to
 * 100 so its card says "Đã hoàn thành" even if content was added after completion.
 */
export function progressBySlug(enrollments: TrackProgress[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const track of enrollments) {
    map.set(track.slug, track.status === 'completed' ? 100 : track.percent);
  }
  return map;
}
