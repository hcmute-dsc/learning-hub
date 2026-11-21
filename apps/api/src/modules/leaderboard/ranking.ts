import type { LeaderboardRow, UserRef } from '@hub/shared';

/**
 * Scoring and ranking for the opt-in leaderboard (E14, ADR-08). Pure, tested in
 * ranking.spec.ts. The input is already limited to opted-in active members and to
 * exercises completed for the first time inside the period; this file only weighs and
 * orders. Time is never an input: no "first to finish" bonus and no speed tie-break.
 */

export interface Weights {
  /** an exercise graded automatically (passed) or approved by a mentor */
  graded: number;
  /** a self_check exercise (the member ticks it themselves) */
  selfCheck: number;
}

export interface MemberCounts {
  user: UserRef;
  /** completed exercises that are not self_check */
  graded: number;
  /** completed self_check exercises */
  selfCheck: number;
}

/** Weighted score of one member. */
export function scoreOf(counts: Pick<MemberCounts, 'graded' | 'selfCheck'>, w: Weights): number {
  return counts.graded * w.graded + counts.selfCheck * w.selfCheck;
}

/**
 * Members with a score above zero, best first, with a dense rank (equal scores share a
 * rank, the next score gets the next number). Equal scores are listed by name so the
 * order is stable; the name never changes the rank.
 */
export function rank(members: MemberCounts[], w: Weights): LeaderboardRow[] {
  const scored = members
    .map((m) => ({ user: m.user, score: scoreOf(m, w), completed: m.graded + m.selfCheck }))
    .filter((m) => m.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.user.displayName.localeCompare(b.user.displayName, 'vi') ||
        a.user.githubLogin.localeCompare(b.user.githubLogin),
    );

  const rows: LeaderboardRow[] = [];
  let currentRank = 0;
  let lastScore: number | null = null;
  for (const m of scored) {
    if (m.score !== lastScore) {
      currentRank += 1;
      lastScore = m.score;
    }
    rows.push({ rank: currentRank, ...m });
  }
  return rows;
}

/** The first `limit` rows and the viewer's own row (null when they are not on the board). */
export function topAndMe(
  rows: LeaderboardRow[],
  viewerId: string,
  limit: number,
): { top: LeaderboardRow[]; me: LeaderboardRow | null } {
  return { top: rows.slice(0, limit), me: rows.find((r) => r.user.id === viewerId) ?? null };
}
