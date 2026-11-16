import 'server-only';
import type { TrackItemsProgress, TrackLevel } from '@hub/shared';
import type { ModuleOutlineData } from '@/components/learn/ModuleOutline';
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
