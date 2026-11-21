import type { UserRef } from './admin';

/**
 * Opt-in leaderboard per term (E14, learning-hub#5, DECISIONS ADR-08).
 * Only members who turned on `leaderboardOptIn` in /settings appear. Scores are counted
 * on the fly from completed exercises in the term, never stored, never by speed, and
 * there is no all-time ranking.
 */

/** How many rows the board shows (FRONTEND-DESIGN §13). */
export const LEADERBOARD_TOP = 10;

/** A term id: "2026-1" = HK1 2026–2027, "2026-2" = HK2 2026–2027, "2026-3" = summer 2027. */
export const TERM_ID_PATTERN = /^\d{4}-[123]$/;

/** An ISO week id in Vietnam time: "2026-W47" (Monday → Monday, learning-hub#88). */
export const WEEK_ID_PATTERN = /^\d{4}-W\d{2}$/;

/** The board covers one term (default) or one week, never all time (ADR-08). */
export const LEADERBOARD_PERIODS = ['term', 'week'] as const;
export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[number];

/** The term or week a board covers. */
export interface LeaderboardRange {
  period: LeaderboardPeriod;
  /** "2026-1" (TERM_ID_PATTERN) or "2026-W47" (WEEK_ID_PATTERN) */
  id: string;
  /** e.g. "Học kỳ 1, 2026–2027" or "Tuần 47 (16/11 – 22/11/2026)" */
  label: string;
  /** first moment, ISO */
  startsAt: string;
  /** first moment after it, ISO (exclusive) */
  endsAt: string;
  /** the term/week before; null for none */
  previousId: string | null;
  /** the term/week after, or null when this is the current one (no future boards) */
  nextId: string | null;
}

export interface LeaderboardRow {
  /** dense rank: equal scores share a rank */
  rank: number;
  user: UserRef;
  /** weighted score (self_check counts less than graded or reviewed exercises) */
  score: number;
  /** completed exercises behind the score */
  completed: number;
}

/**
 * GET /api/v1/leaderboard → { data: Leaderboard }
 * Query (all optional): `period` = term | week; `term` = term id (period term);
 * `week` = week id (period week); `track` = track slug (count only that track's exercises).
 */
export interface Leaderboard {
  range: LeaderboardRange;
  /** the track filter, or null for every track */
  track: { slug: string; title: string } | null;
  /** the viewer's own `leaderboardOptIn` */
  optedIn: boolean;
  /** top LEADERBOARD_TOP rows, best first */
  top: LeaderboardRow[];
  /** the viewer's row when opted in and scoring in the period, else null */
  me: LeaderboardRow | null;
  /** score of one completed exercise by kind, so the page can explain it */
  weights: { graded: number; selfCheck: number };
}

/**
 * GET /api/v1/admin/leaderboard-post → { data: LeaderboardPostStatus } (admin only,
 * learning-hub#83). POST …/post ("Đăng ngay") and POST …/update ("Cập nhật") return it too.
 * Always about last week (Monday → Monday, Vietnam time), the week the Monday job posts.
 */
export interface LeaderboardPostStatus {
  /** ISO week, e.g. "2026-W47" */
  weekId: string;
  /** first moment of the week, ISO */
  startsAt: string;
  /** first moment after the week, ISO (exclusive) */
  endsAt: string;
  /** false when the club webhook is not configured: both buttons are disabled */
  enabled: boolean;
  /**
   * not_posted: nothing for this week yet ("Đăng ngay");
   * queued: waiting in the outbox (Discord failed, retried automatically);
   * posted: on Discord, can be edited ("Cập nhật").
   */
  state: 'not_posted' | 'queued' | 'posted';
  postedAt: string | null;
  updatedAt: string | null;
  /** opted-in members who would be in the post now (top 5) */
  preview: LeaderboardRow[];
}
