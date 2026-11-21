import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { MemberCounts } from './ranking';

interface CountRow {
  id: string;
  github_login: string;
  display_name: string;
  avatar_url: string | null;
  graded: bigint;
  self_check: bigint;
}

/**
 * Reads for the leaderboard (E14). Nothing is stored: every call counts again, so a
 * member who turns the opt-in off is gone from the next read (ADR-08).
 */
@Injectable()
export class LeaderboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Opted-in active members and how many exercises they completed for the FIRST time in
   * [from, to). "Completed" is the rule of exercise-state.ts: a submission `approved`, or
   * `passed` when the exercise needs no review. The completion moment is the approving
   * review's time when there is one, else the submission's last update (when it passed).
   * Redoing an exercise in a later term does not count again.
   */
  async countsBetween(from: Date, to: Date): Promise<MemberCounts[]> {
    const rows = await this.prisma.$queryRaw<CountRow[]>`
      WITH firsts AS (
        SELECT s.user_id, s.exercise_id, e.type,
               MIN(COALESCE(r.approved_at, s.updated_at)) AS completed_at
          FROM submissions s
          JOIN exercises e ON e.id = s.exercise_id
          JOIN users u ON u.id = s.user_id
          LEFT JOIN LATERAL (
                SELECT MIN(rv.submitted_at) AS approved_at
                  FROM reviews rv
                 WHERE rv.submission_id = s.id AND rv.status = 'approved') r ON true
         WHERE u.leaderboard_opt_in
           AND u.status = 'active'
           AND u.deleted_at IS NULL
           AND (s.status = 'approved' OR (s.status = 'passed' AND NOT e.requires_review))
         GROUP BY s.user_id, s.exercise_id, e.type)
      SELECT u.id, u.github_login, u.display_name, u.avatar_url,
             COUNT(*) FILTER (WHERE f.type <> 'self_check') AS graded,
             COUNT(*) FILTER (WHERE f.type = 'self_check') AS self_check
        FROM firsts f
        JOIN users u ON u.id = f.user_id
       WHERE f.completed_at >= ${from} AND f.completed_at < ${to}
       GROUP BY u.id`;
    return rows.map((r) => ({
      user: {
        id: r.id,
        githubLogin: r.github_login,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
      },
      graded: Number(r.graded),
      selfCheck: Number(r.self_check),
    }));
  }

  /** The member's own opt-in (false for an unknown id). */
  async optedIn(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { leaderboardOptIn: true },
    });
    return user?.leaderboardOptIn ?? false;
  }
}
