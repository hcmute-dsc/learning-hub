import {
  LEADERBOARD_PERIODS,
  TERM_ID_PATTERN,
  TRACK_SLUG_PATTERN,
  WEEK_ID_PATTERN,
  type LeaderboardPeriod,
  type LeaderboardRow,
} from '@hub/shared';

/**
 * Pure helpers for /leaderboard and its share image (learning-hub#88), tested in
 * board.test.ts. The page state lives in the URL, so a filtered board can be linked,
 * reloaded and turned into the same image.
 */

export interface BoardQuery {
  period: LeaderboardPeriod;
  /** term id (period term) or week id (period week); undefined = the current one */
  id?: string;
  /** track slug; undefined = every track */
  track?: string;
}

type Params = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Read the filters from the URL; anything malformed is dropped (shows the default). */
export function parseBoardQuery(params: Params): BoardQuery {
  const rawPeriod = first(params.period);
  const period: LeaderboardPeriod = (LEADERBOARD_PERIODS as readonly string[]).includes(
    rawPeriod ?? '',
  )
    ? (rawPeriod as LeaderboardPeriod)
    : 'term';
  const rawId = first(period === 'week' ? params.week : params.term);
  const idPattern = period === 'week' ? WEEK_ID_PATTERN : TERM_ID_PATTERN;
  const rawTrack = first(params.track);
  return {
    period,
    id: rawId && idPattern.test(rawId) ? rawId : undefined,
    track: rawTrack && TRACK_SLUG_PATTERN.test(rawTrack) ? rawTrack : undefined,
  };
}

/** The query string for the API, the page and the image (without "?"; may be empty). */
export function boardSearch(q: BoardQuery): string {
  const params = new URLSearchParams();
  if (q.period === 'week') params.set('period', 'week');
  if (q.id) params.set(q.period === 'week' ? 'week' : 'term', q.id);
  if (q.track) params.set('track', q.track);
  return params.toString();
}

/**
 * Link for a filter change. Switching between term and week drops the chosen id (a
 * term id means nothing as a week); the track stays.
 */
export function boardHref(q: BoardQuery, change: Partial<BoardQuery>): string {
  const next: BoardQuery = { ...q, ...change };
  if (change.period && change.period !== q.period && !('id' in change)) next.id = undefined;
  const search = boardSearch(next);
  return search ? `/leaderboard?${search}` : '/leaderboard';
}

export const SHARE_SIZES = {
  /** fanpage post (Facebook, Instagram) */
  square: { width: 1080, height: 1080, label: 'Vuông 1080×1080 (fanpage)' },
  /** website, link preview */
  wide: { width: 1200, height: 630, label: 'Ngang 1200×630 (website)' },
} as const;
export type ShareSize = keyof typeof SHARE_SIZES;

export function parseShareSize(v: string | string[] | undefined): ShareSize {
  return first(v) === 'wide' ? 'wide' : 'square';
}

/** URL of the PNG for this board (served by app/leaderboard/image/route.tsx). */
export function imageHref(q: BoardQuery, size: ShareSize): string {
  const params = new URLSearchParams(boardSearch(q));
  params.set('size', size);
  return `/leaderboard/image?${params.toString()}`;
}

/** File name when the image is saved: dsc-leaderboard-2026-W47-sql.png */
export function imageFileName(rangeId: string, track: string | null, size: ShareSize): string {
  return ['dsc-leaderboard', rangeId, track, size === 'wide' ? 'wide' : null]
    .filter(Boolean)
    .join('-')
    .concat('.png');
}

export type Medal = 'gold' | 'silver' | 'bronze';

/** Gold, silver, bronze for ranks 1–3 (ties share a medal, like the dense rank). */
export function medalFor(rank: number): Medal | null {
  return rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : null;
}

export const MEDAL_TONE: Record<Medal, { from: string; to: string; label: string }> = {
  gold: { from: '#fde68a', to: '#d97706', label: 'Hạng nhất' },
  silver: { from: '#e5e7eb', to: '#6b7280', label: 'Hạng nhì' },
  bronze: { from: '#fdba74', to: '#b45309', label: 'Hạng ba' },
};

/**
 * The podium is the first three rows (ranks 1–3, ties included), drawn 2nd–1st–3rd like
 * a real podium; everyone after them is the list. With fewer than three people the
 * podium simply has fewer steps.
 */
export function splitPodium(rows: LeaderboardRow[]): {
  podium: LeaderboardRow[];
  rest: LeaderboardRow[];
} {
  const podium = rows.slice(0, 3).filter((r) => r.rank <= 3);
  return { podium, rest: rows.slice(podium.length) };
}

/** Left-to-right order of the podium steps: 2nd, 1st, 3rd. */
export function podiumOrder(podium: LeaderboardRow[]): LeaderboardRow[] {
  if (podium.length < 2) return podium;
  const [a, b, c] = podium;
  return c ? [b, a, c] : [b, a];
}

/** Two-letter initials for a member without an avatar (image card). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const letters = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts.at(-1)![0];
  return letters.toUpperCase();
}
