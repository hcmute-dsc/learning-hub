import { Injectable } from '@nestjs/common';
import type { ExerciseType, SubmissionStatus } from '@hub/shared';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { COMPLETES_EXERCISE, learnersOf } from './learner-sql';
import type { ActivityAt, DoneItem, FirstAttempt, OutlineModule, WaitingRow } from './track-stats';

/**
 * Reads for the track statistics page (learning-hub#118) that the progress report does not
 * have: the outline, who completed which item, first attempts, waiting reviews and activity
 * per day. Learners, "done" and "active item" follow ReportsRepository (learner-sql.ts).
 */
@Injectable()
export class TrackStatsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * An active track by slug. Archived ones are 404, like the catalog (the track page) and the
   * track menu of /admin/reports.
   */
  trackBySlug(slug: string): Promise<{ id: string; slug: string; title: string } | null> {
    return this.prisma.track.findFirst({
      where: { slug, status: 'active' },
      select: { id: true, slug: true, title: true },
    });
  }

  /** Active modules, lessons and exercises, in content order. */
  async outline(trackId: string): Promise<OutlineModule[]> {
    const active = { status: 'active' };
    const modules = await this.prisma.module.findMany({
      where: { trackId, ...active },
      orderBy: { position: 'asc' },
      select: {
        slug: true,
        title: true,
        lessons: {
          where: active,
          orderBy: { position: 'asc' },
          select: { id: true, title: true },
        },
        exercises: {
          where: active,
          orderBy: { position: 'asc' },
          select: { id: true, title: true, type: true },
        },
      },
    });
    return modules.map((m) => ({
      ...m,
      exercises: m.exercises.map((x) => ({ ...x, type: x.type as ExerciseType })),
    }));
  }

  /**
   * Every (learner, lesson or exercise) of this track the learner completed. One row per pair
   * is fine at club size (learners × items in the thousands); if that grows large, count per
   * item in SQL instead and compute the per-module numbers from a smaller query.
   */
  async doneItems(trackId: string): Promise<DoneItem[]> {
    const rows = await this.prisma.$queryRaw<{ user_id: string; item_id: string }[]>`
      WITH learners AS (${learnersOf(trackId)})
      SELECT lp.user_id, lp.lesson_id AS item_id
        FROM lesson_progress lp
        JOIN learners l ON l.user_id = lp.user_id
        JOIN lessons ls ON ls.id = lp.lesson_id
        JOIN modules m ON m.id = ls.module_id
       WHERE m.track_id = ${trackId}::uuid AND lp.status = 'completed'
      UNION
      SELECT s.user_id, s.exercise_id AS item_id
        FROM submissions s
        JOIN learners l ON l.user_id = s.user_id
        JOIN exercises x ON x.id = s.exercise_id
        JOIN modules m ON m.id = x.module_id
       WHERE m.track_id = ${trackId}::uuid AND ${COMPLETES_EXERCISE}`;
    return rows.map((r) => ({ userId: r.user_id, itemId: r.item_id }));
  }

  /** Learners' first attempts (attempt 1) at the track's exercises. */
  async firstAttempts(trackId: string): Promise<FirstAttempt[]> {
    const rows = await this.prisma.$queryRaw<{ exercise_id: string; status: string }[]>`
      WITH learners AS (${learnersOf(trackId)})
      SELECT s.exercise_id, s.status
        FROM submissions s
        JOIN learners l ON l.user_id = s.user_id
        JOIN exercises x ON x.id = s.exercise_id
        JOIN modules m ON m.id = x.module_id
       WHERE m.track_id = ${trackId}::uuid AND s.attempt = 1`;
    return rows.map((r) => ({ exerciseId: r.exercise_id, status: r.status as SubmissionStatus }));
  }

  /** Learners' submissions waiting for a mentor on active exercises, oldest first. */
  async waitingReviews(trackId: string, limit: number): Promise<WaitingRow[]> {
    const rows = await this.prisma.$queryRaw<
      {
        submission_id: string;
        exercise_id: string;
        exercise_title: string;
        github_login: string;
        submitted_at: Date;
      }[]
    >`
      WITH learners AS (${learnersOf(trackId)})
      SELECT s.id AS submission_id, x.id AS exercise_id, x.title AS exercise_title,
             u.github_login, s.submitted_at
        FROM submissions s
        JOIN learners l ON l.user_id = s.user_id
        JOIN users u ON u.id = s.user_id
        JOIN exercises x ON x.id = s.exercise_id
        JOIN modules m ON m.id = x.module_id
       WHERE m.track_id = ${trackId}::uuid AND x.status = 'active' AND m.status = 'active'
         AND s.status = 'awaiting_review'
       ORDER BY s.submitted_at, s.id
       LIMIT ${limit}`;
    return rows.map((r) => ({
      submissionId: r.submission_id,
      exerciseId: r.exercise_id,
      exerciseTitle: r.exercise_title,
      githubLogin: r.github_login,
      submittedAt: r.submitted_at,
    }));
  }

  /**
   * Learners' lesson marks and submissions on active items since `since`, one moment per
   * learner and Vietnam day (enough for weekly counts, and far fewer rows).
   */
  async activity(trackId: string, since: Date): Promise<ActivityAt[]> {
    const rows = await this.prisma.$queryRaw<{ user_id: string; at: Date }[]>`
      WITH learners AS (${learnersOf(trackId)}),
      moments AS (
        SELECT lp.user_id, lp.updated_at AS at
          FROM lesson_progress lp
          JOIN lessons ls ON ls.id = lp.lesson_id
          JOIN modules m ON m.id = ls.module_id
         WHERE m.track_id = ${trackId}::uuid AND ls.status = 'active' AND m.status = 'active'
           AND lp.updated_at >= ${since}
        UNION ALL
        SELECT s.user_id, s.submitted_at
          FROM submissions s
          JOIN exercises x ON x.id = s.exercise_id
          JOIN modules m ON m.id = x.module_id
         WHERE m.track_id = ${trackId}::uuid AND x.status = 'active' AND m.status = 'active'
           AND s.submitted_at >= ${since})
      SELECT mo.user_id, MIN(mo.at) AS at
        FROM moments mo JOIN learners l ON l.user_id = mo.user_id
       GROUP BY mo.user_id, (mo.at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`;
    return rows.map((r) => ({ userId: r.user_id, at: r.at }));
  }
}
