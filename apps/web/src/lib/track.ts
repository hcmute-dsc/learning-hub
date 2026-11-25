import 'server-only';
import type {
  TrackDocPage,
  TrackDocView,
  TrackGlossaryView,
  TrackItemsProgress,
  TrackLevel,
  TrackStats,
  TrackStatsAccess,
} from '@hub/shared';
import type { ModuleOutlineData } from '@/components/learn/ModuleOutline';
import type { TrackDocFlags } from '@/components/track/track-docs';
import { api, ApiError, apiOrNotFound, getMe } from './api';

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

/**
 * Whether the signed-in viewer may open "Thống kê" of this track (learning-hub#118): admins
 * always; mentors only for tracks they mentor, which only the API knows. Members are not
 * asked about, so their track page makes no extra call.
 */
export async function canSeeTrackStats(slug: string): Promise<boolean> {
  const me = await getMe();
  if (!me) return false;
  if (me.roles.includes('admin')) return true;
  if (!me.roles.includes('mentor')) return false;
  try {
    const { data } = await api<{ data: TrackStatsAccess }>(
      `/tracks/${encodeURIComponent(slug)}/stats/access`,
    );
    return data.allowed;
  } catch (e) {
    // The link is a convenience: a failed check hides it instead of breaking the track page.
    if (e instanceof ApiError) return false;
    throw e;
  }
}

/** Statistics of a track; null when the viewer may not see them (403). 404 page for a bad slug. */
export async function loadTrackStats(slug: string): Promise<TrackStats | null> {
  try {
    return (await apiOrNotFound<{ data: TrackStats }>(`/tracks/${encodeURIComponent(slug)}/stats`))
      .data;
  } catch (e) {
    if (e instanceof ApiError && e.problem.status === 403) return null;
    throw e;
  }
}
