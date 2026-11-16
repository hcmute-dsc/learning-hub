import { TRACK_LEVELS, type TrackLevel, type TrackProgress } from '@hub/shared';

/**
 * Pure helpers for the track catalog page (app/tracks/page.tsx), tested in catalog.test.ts.
 */

export interface CatalogFilters {
  q?: string;
  level?: TrackLevel;
}

/** Reads ?q=&level= from the URL, dropping an empty search and an unknown level. */
export function parseFilters(params: { q?: string; level?: string }): CatalogFilters {
  const q = params.q?.trim() || undefined;
  const level = (TRACK_LEVELS as readonly string[]).includes(params.level ?? '')
    ? (params.level as TrackLevel)
    : undefined;
  return { q, level };
}

/** Query string for GET /tracks. */
export function tracksQuery(filters: CatalogFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.level) params.set('level', filters.level);
  return params.toString();
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
