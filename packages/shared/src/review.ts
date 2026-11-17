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

/** GET /api/v1/reviews/queue (mentor) → { data: ReviewQueue }, oldest submission first */
export interface ReviewQueue {
  /** REVIEW_TARGET_HOURS: a submission waiting longer is highlighted */
  targetHours: number;
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
  };
  track: { slug: string; title: string };
  /** the member's earlier attempts of this exercise, newest first */
  earlierAttempts: ReviewedSubmission[];
  openReview: OpenReview | null;
  /** false for the member's own submission: nobody reviews their own work */
  canReview: boolean;
}
