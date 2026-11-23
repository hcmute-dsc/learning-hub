import 'server-only';
import type {
  TrackDocPage,
  TrackDocView,
  TrackGlossaryView,
  TrackItemsProgress,
  TrackLevel,
} from '@hub/shared';
import type { ModuleOutlineData } from '@/components/learn/ModuleOutline';
import type { TrackDocFlags } from '@/components/track/track-docs';
import { api, apiOrNotFound } from './api';

/** GET /tracks/:slug (catalog module; the type is not in @hub/shared yet). */
export interface TrackDetail {
  slug: string;
  title: string;
  summary: string | null;
  level: TrackLevel;
  estHours: number | null;
  tags: string[];
  starterRepo: string | null;
  /** which optional pages the track has ("Cài đặt", "Tài liệu thêm") */
  docs: TrackDocFlags;
  /** the track has a "Từ vựng" page (glossary.yaml, learning-hub#106) */
  hasGlossary?: boolean;
  source: { repo: string; commitSha: string; path: string };
  modules: ModuleOutlineData[];
}

/** Track outline (404 page when the slug is unknown). Used by the track and lesson pages. */
export async function loadTrack(slug: string): Promise<TrackDetail> {
  return (await apiOrNotFound<{ data: TrackDetail }>(`/tracks/${encodeURIComponent(slug)}`)).data;
}

/** Status of every lesson and exercise of the track for the signed-in member. */
export async function loadTrackProgress(slug: string): Promise<TrackItemsProgress> {
  return (await api<{ data: TrackItemsProgress }>(`/tracks/${encodeURIComponent(slug)}/progress`))
    .data;
}

/** "Cài đặt" or "Tài liệu thêm" of a track (404 page when the track has no such page). */
export async function loadTrackDoc(slug: string, page: TrackDocPage): Promise<TrackDocView> {
  return (
    await apiOrNotFound<{ data: TrackDocView }>(
      `/tracks/${encodeURIComponent(slug)}/docs/${encodeURIComponent(page)}`,
    )
  ).data;
}

/** "Từ vựng" of a track (404 page when the track has no glossary). */
export async function loadTrackGlossary(slug: string): Promise<TrackGlossaryView> {
  return (
    await apiOrNotFound<{ data: TrackGlossaryView }>(`/tracks/${encodeURIComponent(slug)}/glossary`)
  ).data;
}
