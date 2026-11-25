import { z } from 'zod';

/**
 * Statistics of one track for admins and mentors (learning-hub#118,
 * INFORMATION-ARCHITECTURE "Thống kê track"). Counted on the fly, nothing is stored.
 * Learners and "done" follow the progress report (`/admin/reports`, learning-hub#34), so
 * the totals match that report for the same track and the same 14 days.
 */

/**
 * Periods a viewer can pick (`?days=`, learning-hub#126): the last this many Vietnam days,
 * today included. "Đang học" and the review numbers count inside the period, and the totals
 * are compared with the same number of days just before it.
 */
export const TRACK_STATS_DAYS_OPTIONS = [7, 14, 30, 90] as const;
export type TrackStatsDays = (typeof TRACK_STATS_DAYS_OPTIONS)[number];

/** The period without `?days=`: two weeks, like the stats page before #126. */
export const TRACK_STATS_ACTIVE_DAYS: TrackStatsDays = 14;

/** `?days=` as a period length; anything else (missing, "abc", "8") is the default. */
export function trackStatsDays(raw: unknown): TrackStatsDays {
  const n = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : NaN;
  return (TRACK_STATS_DAYS_OPTIONS as readonly number[]).includes(n)
    ? (n as TrackStatsDays)
    : TRACK_STATS_ACTIVE_DAYS;
}

/** Query of GET /tracks/:slug/stats: `days` must be one of TRACK_STATS_DAYS_OPTIONS. */
export const trackStatsQuerySchema = z.object({
  days: z
    .enum(TRACK_STATS_DAYS_OPTIONS.map(String) as [string, ...string[]])
    .optional()
    .transform((d) => trackStatsDays(d)),
});

/**
 * "Lâu không hoạt động": no lesson mark or submission for at least this many days, counted
 * from enrolling for a learner who never started.
 */
export const TRACK_STATS_INACTIVE_DAYS = 7;

/** Weeks (Monday → Sunday, Vietnam time) in the weekly chart, this week included. */
export const TRACK_STATS_WEEKS = 12;

/** Rows in each "hardest exercises" table. */
export const TRACK_STATS_TOP = 10;

/** Most inactive learners listed (oldest activity first); the count is always exact. */
export const TRACK_STATS_INACTIVE_LIMIT = 200;

const count = z.number().int().nonnegative();
const rate = z.number().int().min(0).max(100);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const trackStatsTotalsSchema = z.object({
  /** learners enrolled in the track */
  enrolled: count,
  /** learners who marked a lesson or submitted during the period */
  active: count,
  /** learners who completed the track */
  completed: count,
  /** completed / enrolled, 0–100 */
  completionRate: rate,
  /**
   * learners' submissions waiting for a mentor right now (lúc xem trang), not at the end of
   * the period; in `previous`, only of learners enrolled by its end
   */
  awaitingReview: count,
  /** reviews concluded during the period */
  reviewsDone: count,
  /** hours from submission to conclusion of those reviews; null without reviews */
  reviewHoursMedian: z.number().nullable(),
});

export const trackFunnelItemSchema = z.object({
  kind: z.enum(['lesson', 'exercise']),
  id: z.string().uuid(),
  title: z.string(),
  /** learners who completed it */
  completed: count,
});

export const trackFunnelModuleSchema = z.object({
  slug: z.string(),
  title: z.string(),
  /** learners who completed every lesson and exercise of the module (0 for an empty one) */
  completed: count,
  /** learners who completed at least one lesson or exercise of the module */
  started: count,
  /** lessons first, then exercises, in content order (like the track page) */
  items: z.array(trackFunnelItemSchema),
});

export const hardExerciseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  moduleTitle: z.string(),
  /** learners' first attempts with an automatic result (quiz, code) */
  firstAttempts: count,
  /** of those, the ones that did not pass */
  failed: count,
  /** failed / firstAttempts, 0–100 */
  failRate: rate,
});

export const waitingReviewSchema = z.object({
  submissionId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  exerciseTitle: z.string(),
  githubLogin: z.string(),
  submittedAt: z.string(),
  /** hours since submission, one decimal */
  hoursWaiting: z.number(),
});

export const trackStatsWeekSchema = z.object({
  /** Monday of the week, Vietnam time */
  weekStart: day,
  /** learners who enrolled that week */
  enrolled: count,
  /** learners who marked a lesson or submitted that week */
  active: count,
});

/**
 * Learners by share of the track's lessons and exercises done: [from, to) percent, and the
 * last bucket (from = to = 100) is everyone who did every item or completed the track.
 */
export const progressBucketSchema = z.object({
  from: rate,
  to: rate,
  learners: count,
});

/** Bucket edges of the progress histogram, in percent (see progressBucketSchema). */
export const TRACK_STATS_PROGRESS_EDGES = [0, 25, 50, 75, 100] as const;

const periodSchema = z.object({ from: day, to: day });

export const inactiveLearnerSchema = z.object({
  githubLogin: z.string(),
  enrolledAt: z.string(),
  /** lessons + exercises done, of the track's total */
  itemsDone: count,
  itemsTotal: count,
  /** itemsDone / itemsTotal, 0–100 */
  progress: rate,
  /** null = never marked a lesson nor submitted */
  lastActiveAt: z.string().nullable(),
});

/** GET /api/v1/tracks/:slug/stats → { data: TrackStats } (admins and mentors, every track) */
export const trackStatsSchema = z.object({
  track: z.object({ slug: z.string(), title: z.string() }),
  generatedAt: z.string(),
  /** the `days` Vietnam days behind `active` and the review numbers, today last */
  period: periodSchema.extend({ days: z.number().int().positive() }),
  totals: trackStatsTotalsSchema,
  /**
   * the same number of days just before `period`, for "+3 so với kỳ trước". Its
   * `awaitingReview` is still "lúc xem trang, như kỳ này" (the report counts what waits now),
   * so the page does not compare it.
   * (Learners and reviews do follow the previous period.)
   */
  previous: z.object({ period: periodSchema, totals: trackStatsTotalsSchema }),
  /** every enrolled learner by progress, now; TRACK_STATS_PROGRESS_EDGES buckets */
  progress: z.array(progressBucketSchema),
  funnel: z.array(trackFunnelModuleSchema),
  hardest: z.object({
    /** highest first-attempt fail rate first */
    firstAttempt: z.array(hardExerciseSchema),
    /** longest waiting first */
    waitingReviews: z.array(waitingReviewSchema),
  }),
  /** oldest week first, TRACK_STATS_WEEKS of them */
  weekly: z.array(trackStatsWeekSchema),
  /**
   * not completed and quiet for TRACK_STATS_INACTIVE_DAYS days or more, since the last
   * activity or, for someone who never started, since enrolling (never active first)
   */
  inactive: z.object({ total: count, learners: z.array(inactiveLearnerSchema) }),
});

export type TrackStatsTotals = z.infer<typeof trackStatsTotalsSchema>;
export type TrackFunnelItem = z.infer<typeof trackFunnelItemSchema>;
export type TrackFunnelModule = z.infer<typeof trackFunnelModuleSchema>;
export type HardExercise = z.infer<typeof hardExerciseSchema>;
export type WaitingReview = z.infer<typeof waitingReviewSchema>;
export type TrackStatsWeek = z.infer<typeof trackStatsWeekSchema>;
export type InactiveLearner = z.infer<typeof inactiveLearnerSchema>;
export type ProgressBucket = z.infer<typeof progressBucketSchema>;
export type TrackStats = z.infer<typeof trackStatsSchema>;
