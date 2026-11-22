import { z } from 'zod';
import type { SubmissionStatus } from './index';

/**
 * API contract for mentor review (E7): review queue, review page, and the review a
 * member sees on their submission. Filled in by the E7 work (17/11/2026).
 * Every response body is `{ data: ... }`.
 */

export const REVIEW_OUTCOMES = ['approved', 'changes_requested'] as const;
export type ReviewOutcome = (typeof REVIEW_OUTCOMES)[number];

/** Longest review summary (Markdown). Enough for a detailed review, small enough to render. */
export const REVIEW_SUMMARY_MAX = 5000;

/** One rubric line as the mentor scores it: 0..weight points, whole numbers. */
export const rubricScoreSchema = z
  .object({
    criterion: z.string().trim().min(1).max(300),
    score: z.number().int().min(0).max(100),
  })
  .strict();
export type RubricScoreInput = z.infer<typeof rubricScoreSchema>;

/**
 * POST /api/v1/reviews/:id/complete → { data: CompletedReview }.
 * A summary is required when asking for changes: the member must know what to fix.
 * Whether each score fits its criterion's weight is checked by the API (it knows the rubric).
 */
export const completeReviewSchema = z
  .object({
    outcome: z.enum(REVIEW_OUTCOMES),
    summaryMd: z.string().trim().max(REVIEW_SUMMARY_MAX).default(''),
    rubricScores: z.array(rubricScoreSchema).max(50).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.outcome === 'changes_requested' && value.summaryMd.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['summaryMd'],
        message: 'Hãy viết nhận xét để thành viên biết cần sửa gì.',
      });
    }
  });
export type CompleteReviewInput = z.input<typeof completeReviewSchema>;

/** A person shown next to a submission or a review. */
export interface PersonRef {
  id: string;
  githubLogin: string;
  displayName: string;
  avatarUrl: string | null;
}

/** One scored rubric line; `weight` is copied when the review is completed. */
export interface RubricScoreView {
  criterion: string;
  weight: number;
  score: number;
}

/**
 * A finished review, as the member and other mentors see it. In-progress reviews are
 * never sent to members (they are the mentor's draft).
 */
export interface CompletedReview {
  id: string;
  outcome: ReviewOutcome;
  summaryMd: string | null;
  rubricScores: RubricScoreView[];
  /** 0–100 (scores / weights), null when the review has no rubric scores */
  rubricTotal: number | null;
  reviewer: PersonRef;
  completedAt: string;
}

/** A review a mentor has claimed and not finished yet. */
export interface OpenReview {
  id: string;
  submissionId: string;
  reviewer: PersonRef;
  claimedAt: string;
}

/** Track slug, as in the content repo (lowercase words joined by `-`). */
export const TRACK_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** GitHub login: letters, digits and single `-`, at most 39 characters. */
export const GITHUB_LOGIN_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

/**
 * GET /api/v1/reviews/queue?track=&mentee= (mentor). Both filters are optional and can be
 * combined: `track` is a track slug, `mentee` the GitHub login of the member who submitted.
 */
export const reviewQueueQuerySchema = z
  .object({
    track: z.string().max(80).regex(TRACK_SLUG_PATTERN).optional(),
    mentee: z.string().regex(GITHUB_LOGIN_PATTERN).optional(),
  })
  .strict();
export type ReviewQueueQuery = z.infer<typeof reviewQueueQuerySchema>;

/** A mentee counts as inactive after this many days without a submission or lesson progress. */
export const MENTEE_INACTIVE_DAYS = 14;

/** Numbers for the mentor dashboard, counted in the database for the current filter. */
export interface ReviewQueueStats {
  /** submissions waiting for review */
  waiting: number;
  /** of those, how many a mentor has already claimed */
  claimed: number;
  /** of those, how many have waited longer than targetHours */
  overTarget: number;
  /** whole hours the oldest waiting submission has waited; null when nothing waits */
  oldestHoursWaiting: number | null;
  /**
   * The viewer's active mentees (mentor_assignments) with no activity for
   * MENTEE_INACTIVE_DAYS days; null when the viewer has no mentees (E8 not used yet).
   * Not affected by the filters.
   */
  inactiveMentees: number | null;
}

/**
 * GET /api/v1/reviews/queue/count (mentor) → { data: ReviewQueueCount }.
 * The number on the header's "Review" link (learning-hub#97): cheap, no rows.
 */
export interface ReviewQueueCount {
  /** submissions waiting for review that no mentor has claimed yet */
  unclaimed: number;
}

/** GET /api/v1/reviews/queue (mentor) → { data: ReviewQueue }, oldest submission first */
export interface ReviewQueue {
  /** REVIEW_TARGET_HOURS: a submission waiting longer is highlighted */
  targetHours: number;
  /** the filters applied, echoed back (null = not filtered) */
  filters: { track: string | null; mentee: string | null };
  stats: ReviewQueueStats;
  /** choices for the filter form */
  options: {
    /** active tracks, in catalog order */
    tracks: { slug: string; title: string }[];
    /** the viewer's active mentees; empty → the mentee filter is not shown */
    mentees: PersonRef[];
  };
  /** at most 200 rows; `stats` counts all of them */
  items: ReviewQueueItem[];
}

export interface ReviewQueueItem {
  submissionId: string;
  attempt: number;
  submittedAt: string;
  /** whole hours since submittedAt */
  hoursWaiting: number;
  overTarget: boolean;
  member: PersonRef;
  exercise: { id: string; title: string };
  track: { slug: string; title: string };
  /** null = nobody is reviewing it yet */
  openReview: OpenReview | null;
}

/** A submission as the review page shows it. */
export interface ReviewedSubmission {
  id: string;
  attempt: number;
  status: SubmissionStatus;
  sourceUrl: string | null;
  note: string | null;
  submittedAt: string;
  /** the finished review of this attempt, if any */
  review: CompletedReview | null;
}

/** GET /api/v1/reviews/submissions/:submissionId (mentor) → { data: ReviewPage } */
export interface ReviewPage {
  submission: ReviewedSubmission;
  member: PersonRef;
  exercise: {
    id: string;
    title: string;
    statementMd: string;
    rubric: { criterion: string; weight: number }[];
    /**
     * mentor-notes.md from the content repo (CONTENT-SPECIFICATION §3.10); null when the
     * exercise has none. Only this mentor endpoint sends it, never the member's ExerciseView.
     * Markdown: the web MUST sanitize when rendering (SECURITY §3).
     */
    mentorNotesMd: string | null;
  };
  track: { slug: string; title: string };
  /** the member's earlier attempts of this exercise, newest first */
  earlierAttempts: ReviewedSubmission[];
  openReview: OpenReview | null;
  /** false for the member's own submission: nobody reviews their own work */
  canReview: boolean;
}
