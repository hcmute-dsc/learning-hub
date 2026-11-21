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

export interface LeaderboardTerm {
  /** e.g. "2026-1" (see TERM_ID_PATTERN) */
  id: string;
  /** e.g. "Học kỳ 1, 2026–2027" */
  label: string;
  /** first moment of the term, ISO */
  startsAt: string;
  /** first moment after the term, ISO (exclusive) */
  endsAt: string;
  /** the term before, for the "previous term" link; null for none */
  previousId: string | null;
  /** the term after, or null when this is the current term (no future boards) */
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

/** GET /api/v1/leaderboard?term=<id> → { data: Leaderboard } */
export interface Leaderboard {
  term: LeaderboardTerm;
  /** the viewer's own `leaderboardOptIn` */
  optedIn: boolean;
  /** top LEADERBOARD_TOP rows, best first */
  top: LeaderboardRow[];
  /** the viewer's row when opted in and scoring in the term, else null */
  me: LeaderboardRow | null;
  /** score of one completed exercise by kind, so the page can explain it */
  weights: { graded: number; selfCheck: number };
}
