import { TRACK_DOC_PAGES, type Role, type TrackDocPage } from '@hub/shared';
import { glossaryHref } from './glossary';

/**
 * Optional track pages "Cài đặt" and "Tài liệu thêm" (CONTENT-SPECIFICATION §3.1b,
 * learning-hub#44), like the "Installation" and "Resources" pages of an Exercism track.
 * Pure functions: tested in track-docs.test.ts.
 */

/** Which pages a track has, as GET /tracks/:slug returns it (`docs`). */
export type TrackDocFlags = Record<TrackDocPage, boolean>;

export const TRACK_DOC_LABEL: Record<TrackDocPage, string> = {
  setup: 'Cài đặt',
  resources: 'Tài liệu thêm',
};

/** One line under the page title, so members know why the page is there. */
export const TRACK_DOC_INTRO: Record<TrackDocPage, string> = {
  setup:
    'Cài công cụ cho lộ trình này và tự kiểm tra bài trên máy của bạn. Làm một lần, trước bài đầu tiên.',
  resources: 'Sách, trang web và video để học sâu hơn những gì lộ trình đã dạy.',
};

/** True for the `[page]` route segments that exist: `setup`, `resources`. */
export function isTrackDocPage(value: string): value is TrackDocPage {
  return (TRACK_DOC_PAGES as readonly string[]).includes(value);
}

export function trackDocHref(trackSlug: string, page: TrackDocPage): string {
  return `/tracks/${trackSlug}/${page}`;
}

export interface TrackTab {
  label: string;
  href: string;
  current: boolean;
}

/** "Từ vựng" (learning-hub#106): the track's glossary.yaml, at /tracks/:slug/glossary. */
export const GLOSSARY_LABEL = 'Từ vựng';

/** "Thống kê" (learning-hub#118): only for admins and mentors. */
export const STATS_LABEL = 'Thống kê';

/** Admins and mentors see every track's statistics, like the review queue (#30). */
export function canSeeStats(roles: readonly Role[]): boolean {
  return roles.includes('admin') || roles.includes('mentor');
}

export function trackStatsHref(trackSlug: string): string {
  return `/tracks/${trackSlug}/stats`;
}

/**
 * Tabs at the top of the track page and its sub-pages: "Tổng quan", then only the pages the
 * track has, then "Từ vựng" when it has a glossary, then "Thống kê" when the viewer may see
 * it (`canSeeStats`). Empty when it has none of them, because a single
 * tab would be noise.
 */
export function trackTabs(
  trackSlug: string,
  track: { docs?: Partial<TrackDocFlags>; hasGlossary?: boolean; canSeeStats?: boolean },
  current: 'overview' | 'glossary' | 'stats' | TrackDocPage,
): TrackTab[] {
  const pages = TRACK_DOC_PAGES.filter((page) => track.docs?.[page]);
  const tabs: TrackTab[] = pages.map((page) => ({
    label: TRACK_DOC_LABEL[page],
    href: trackDocHref(trackSlug, page),
    current: current === page,
  }));
  if (track.hasGlossary)
    tabs.push({
      label: GLOSSARY_LABEL,
      href: glossaryHref(trackSlug),
      current: current === 'glossary',
    });
  if (track.canSeeStats)
    tabs.push({
      label: STATS_LABEL,
      href: trackStatsHref(trackSlug),
      current: current === 'stats',
    });
  if (tabs.length === 0) return [];
  return [
    { label: 'Tổng quan', href: `/tracks/${trackSlug}`, current: current === 'overview' },
    ...tabs,
  ];
}
