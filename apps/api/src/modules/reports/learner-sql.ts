import { Prisma } from '@prisma/client';

/**
 * SQL pieces shared by the progress report (ReportsRepository) and the track statistics
 * (TrackStatsRepository), so both count the same people and the same "done"
 * (learning-hub-docs `docs/ops/TRIAL-P0.md` §5.2).
 */

/** For an enrollment `e`: its user is not an admin or a mentor (staff are not learners). */
export const NOT_STAFF = Prisma.sql`NOT EXISTS (
  SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
   WHERE ur.user_id = e.user_id AND r.code IN ('admin', 'mentor'))`;

/**
 * For a submission `s` of exercise `x`: it completes the exercise when approved, or when it
 * passed and the exercise needs no review (the leaderboard rule, DATABASE §6).
 */
export const COMPLETES_EXERCISE = Prisma.sql`(s.status = 'approved' OR (s.status = 'passed' AND NOT x.requires_review))`;

/** `learners` CTE body: user ids of the track's learners (enrolled, not deleted, not staff). */
export function learnersOf(trackId: string): Prisma.Sql {
  return Prisma.sql`SELECT e.user_id FROM enrollments e
      JOIN users u ON u.id = e.user_id AND u.deleted_at IS NULL
     WHERE e.track_id = ${trackId}::uuid AND ${NOT_STAFF}`;
}
