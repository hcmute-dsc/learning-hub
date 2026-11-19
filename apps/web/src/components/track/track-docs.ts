import { TRACK_DOC_PAGES, type TrackDocPage } from '@hub/shared';

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

/**
 * Tabs at the top of the track page and its sub-pages: "Tổng quan", then only the pages the
 * track has. Empty when it has none, because a single tab would be noise.
 */
export function trackTabs(
  trackSlug: string,
  docs: Partial<TrackDocFlags> | undefined,
  current: 'overview' | TrackDocPage,
): TrackTab[] {
  const pages = TRACK_DOC_PAGES.filter((page) => docs?.[page]);
  if (pages.length === 0) return [];
  return [
    { label: 'Tổng quan', href: `/tracks/${trackSlug}`, current: current === 'overview' },
    ...pages.map((page) => ({
      label: TRACK_DOC_LABEL[page],
      href: trackDocHref(trackSlug, page),
      current: current === page,
    })),
  ];
}
