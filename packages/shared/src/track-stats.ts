import { z } from 'zod';

/**
 * Statistics of one track for admins and mentors (learning-hub#118,
 * INFORMATION-ARCHITECTURE "Thống kê track"). Counted on the fly, nothing is stored.
 * Learners and "done" follow the progress report (`/admin/reports`, learning-hub#34), so
 * the totals match that report for the same track and the same 14 days.
 */

/** "Đang học": marked a lesson or submitted in the last this many days (Vietnam days). */
export const TRACK_STATS_ACTIVE_DAYS = 14;

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
  /** learners who marked a lesson or submitted in the last TRACK_STATS_ACTIVE_DAYS days */
  active: count,
  /** learners who completed the track */
  completed: count,
  /** completed / enrolled, 0–100 */
  completionRate: rate,
  /** learners' submissions waiting for a mentor right now */
  awaitingReview: count,
  /** reviews concluded in the last TRACK_STATS_ACTIVE_DAYS days */
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
  /** the TRACK_STATS_ACTIVE_DAYS Vietnam days behind `active` and the review numbers */
  period: z.object({ from: day, to: day }),
  totals: trackStatsTotalsSchema,
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
export type TrackStats = z.infer<typeof trackStatsSchema>;
