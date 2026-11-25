import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { REPORT_NO_COHORT } from '@hub/shared';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { COMPLETES_EXERCISE, NOT_STAFF } from './learner-sql';
import type { MemberFact, ReviewFact } from './report-stats';

export interface ReportFilter {
  startsAt: Date;
  endsAt: Date;
  trackId?: string;
  /** a cohort label, or REPORT_NO_COHORT */
  cohort?: string;
}

interface FactRow {
  user_id: string;
  github_login: string;
  track_id: string;
  track_slug: string;
  track_title: string;
  cohort: string | null;
  enrolled_at: Date;
  completed_at: Date | null;
  lessons_in_period: bigint;
  lessons_done: bigint;
  lessons_total: bigint;
  exercises_in_period: bigint;
  exercises_done: bigint;
  exercises_total: bigint;
  awaiting_review: bigint;
  active_in_period: boolean;
  last_active_at: Date | null;
}

interface ReviewRow {
  user_id: string;
  track_id: string;
  reviewer_id: string;
  hours: number;
}

/**
 * Reads for the progress report (learning-hub#34). Counts on the fly, stores nothing.
 * Same rules as the trial queries in learning-hub-docs `docs/ops/TRIAL-P0.md` §5.2:
 * - a learner is an enrollment of a not-deleted user without the admin or mentor role;
 * - an exercise is completed the first time a submission is `approved`, or `passed` when it
 *   needs no review; the moment is the approving review, else the submission's last update
 *   (the leaderboard rule, DATABASE §6);
 * - only active lessons and exercises of the track count.
 */
@Injectable()
export class ReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** One fact per learner enrollment made before the end of the period. */
  async memberFacts(filter: ReportFilter): Promise<MemberFact[]> {
    const { startsAt, endsAt } = filter;
    const rows = await this.prisma.$queryRaw<FactRow[]>`
      WITH learners AS (
        SELECT e.user_id, e.track_id, e.cohort, e.enrolled_at,
               CASE WHEN e.completed_at < ${endsAt} THEN e.completed_at END AS completed_at
          FROM enrollments e
          JOIN users u ON u.id = e.user_id AND u.deleted_at IS NULL
         WHERE e.enrolled_at < ${endsAt}
           ${this.trackFilter(filter)}
           ${this.cohortFilter(filter)}
           AND ${NOT_STAFF}),
      track_lessons AS (
        SELECT l.id, m.track_id FROM lessons l JOIN modules m ON m.id = l.module_id
         WHERE l.status = 'active' AND m.status = 'active'),
      track_exercises AS (
        SELECT x.id, m.track_id, x.requires_review FROM exercises x
          JOIN modules m ON m.id = x.module_id
         WHERE x.status = 'active' AND m.status = 'active'),
      lessons AS (
        SELECT lp.user_id, tl.track_id,
               COUNT(*) FILTER (WHERE lp.completed_at < ${endsAt}) AS done,
               COUNT(*) FILTER (WHERE lp.completed_at >= ${startsAt}
                                  AND lp.completed_at < ${endsAt}) AS in_period
          FROM lesson_progress lp JOIN track_lessons tl ON tl.id = lp.lesson_id
         WHERE lp.status = 'completed'
         GROUP BY lp.user_id, tl.track_id),
      first_done AS (
        SELECT s.user_id, x.track_id, s.exercise_id,
               MIN(COALESCE(r.approved_at, s.updated_at)) AS done_at
          FROM submissions s
          JOIN track_exercises x ON x.id = s.exercise_id
          LEFT JOIN LATERAL (
                SELECT MIN(rv.submitted_at) AS approved_at FROM reviews rv
                 WHERE rv.submission_id = s.id AND rv.status = 'approved') r ON true
         WHERE ${COMPLETES_EXERCISE}
         GROUP BY s.user_id, x.track_id, s.exercise_id),
      exercises AS (
        SELECT user_id, track_id,
               COUNT(*) FILTER (WHERE done_at < ${endsAt}) AS done,
               COUNT(*) FILTER (WHERE done_at >= ${startsAt} AND done_at < ${endsAt}) AS in_period
          FROM first_done GROUP BY user_id, track_id),
      awaiting AS (
        SELECT s.user_id, x.track_id, COUNT(*) AS n
          FROM submissions s JOIN track_exercises x ON x.id = s.exercise_id
         WHERE s.status = 'awaiting_review'
         GROUP BY s.user_id, x.track_id),
      activity AS (
        SELECT user_id, track_id, MAX(at) AS last_at, BOOL_OR(at >= ${startsAt}) AS in_period
          FROM (SELECT lp.user_id, tl.track_id, lp.updated_at AS at
                  FROM lesson_progress lp JOIN track_lessons tl ON tl.id = lp.lesson_id
                UNION ALL
                SELECT s.user_id, x.track_id, s.submitted_at
                  FROM submissions s JOIN track_exercises x ON x.id = s.exercise_id) a
         WHERE at < ${endsAt}
         GROUP BY user_id, track_id),
      totals AS (
        SELECT t.id AS track_id,
               (SELECT COUNT(*) FROM track_lessons tl WHERE tl.track_id = t.id) AS lessons,
               (SELECT COUNT(*) FROM track_exercises x WHERE x.track_id = t.id) AS exercises
          FROM tracks t)
      SELECT l.user_id, u.github_login, l.track_id, t.slug AS track_slug, t.title AS track_title,
             l.cohort, l.enrolled_at, l.completed_at,
             COALESCE(ls.in_period, 0) AS lessons_in_period, COALESCE(ls.done, 0) AS lessons_done,
             tot.lessons AS lessons_total,
             COALESCE(ex.in_period, 0) AS exercises_in_period, COALESCE(ex.done, 0) AS exercises_done,
             tot.exercises AS exercises_total,
             COALESCE(aw.n, 0) AS awaiting_review,
             COALESCE(ac.in_period, false) AS active_in_period, ac.last_at AS last_active_at
        FROM learners l
        JOIN users u ON u.id = l.user_id
        JOIN tracks t ON t.id = l.track_id
        JOIN totals tot ON tot.track_id = l.track_id
        LEFT JOIN lessons ls ON ls.user_id = l.user_id AND ls.track_id = l.track_id
        LEFT JOIN exercises ex ON ex.user_id = l.user_id AND ex.track_id = l.track_id
        LEFT JOIN awaiting aw ON aw.user_id = l.user_id AND aw.track_id = l.track_id
        LEFT JOIN activity ac ON ac.user_id = l.user_id AND ac.track_id = l.track_id`;
    return rows.map((r) => ({
      userId: r.user_id,
      githubLogin: r.github_login,
      trackId: r.track_id,
      trackSlug: r.track_slug,
      trackTitle: r.track_title,
      cohort: r.cohort,
      enrolledAt: r.enrolled_at,
      completedAt: r.completed_at,
      lessonsInPeriod: Number(r.lessons_in_period),
      lessonsDone: Number(r.lessons_done),
      lessonsTotal: Number(r.lessons_total),
      exercisesInPeriod: Number(r.exercises_in_period),
      exercisesDone: Number(r.exercises_done),
      exercisesTotal: Number(r.exercises_total),
      awaitingReview: Number(r.awaiting_review),
      activeInPeriod: r.active_in_period,
      lastActiveAt: r.last_active_at,
    }));
  }

  /**
   * Reviews concluded (approved or changes requested) in the period, with the submission's
   * owner and track; the report keeps those of its learners.
   */
  async reviewFacts(filter: ReportFilter): Promise<ReviewFact[]> {
    const trackFilter = filter.trackId
      ? Prisma.sql`AND m.track_id = ${filter.trackId}::uuid`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<ReviewRow[]>`
      SELECT s.user_id, m.track_id, rv.reviewer_id,
             EXTRACT(EPOCH FROM rv.submitted_at - s.submitted_at)::float8 / 3600 AS hours
        FROM reviews rv
        JOIN submissions s ON s.id = rv.submission_id
        JOIN exercises x ON x.id = s.exercise_id
        JOIN modules m ON m.id = x.module_id
       WHERE rv.status IN ('approved', 'changes_requested')
         AND rv.submitted_at >= ${filter.startsAt} AND rv.submitted_at < ${filter.endsAt}
         ${trackFilter}`;
    return rows.map((r) => ({
      userId: r.user_id,
      trackId: r.track_id,
      reviewerId: r.reviewer_id,
      hours: Number(r.hours),
    }));
  }

  /** Tracks for the filter menu (archived ones are left out). */
  tracks(): Promise<{ id: string; slug: string; title: string }[]> {
    return this.prisma.track.findMany({
      where: { status: 'active' },
      select: { id: true, slug: true, title: true },
      orderBy: [{ position: 'asc' }, { title: 'asc' }],
    });
  }

  /** Every cohort label ever used, for the filter menu. */
  async cohorts(): Promise<string[]> {
    const rows = await this.prisma.enrollment.findMany({
      where: { cohort: { not: null } },
      distinct: ['cohort'],
      select: { cohort: true },
      orderBy: { cohort: 'asc' },
    });
    return rows.map((r) => r.cohort!);
  }

  private trackFilter(filter: ReportFilter): Prisma.Sql {
    return filter.trackId ? Prisma.sql`AND e.track_id = ${filter.trackId}::uuid` : Prisma.empty;
  }

  private cohortFilter(filter: ReportFilter): Prisma.Sql {
    if (filter.cohort === undefined) return Prisma.empty;
    if (filter.cohort === REPORT_NO_COHORT) return Prisma.sql`AND e.cohort IS NULL`;
    return Prisma.sql`AND e.cohort = ${filter.cohort}`;
  }
}
