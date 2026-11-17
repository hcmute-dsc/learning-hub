import type {
  CompletedReview,
  OpenReview,
  PersonRef,
  ReviewOutcome,
  ReviewQueueItem,
  ReviewedSubmission,
  RubricScoreView,
} from '@hub/shared';
import type {
  QueuedSubmission,
  SubmissionForReview,
} from '../submissions/submission-review.service';
import { rubricTotal, waitingTime } from './review-rules';

/**
 * Database rows → API contract for reviews (pure, tested in review-view.spec.ts).
 * The one rule that matters: an in-progress review is the mentor's draft and is never
 * turned into a CompletedReview.
 */

/** The `reviews` columns these mappers need. */
export interface ReviewRow {
  id: string;
  submissionId: string;
  reviewerId: string;
  status: string;
  summaryMd: string | null;
  rubricScores: unknown;
  submittedAt: Date | null;
  createdAt: Date;
}

/** Prisma `select` matching ReviewRow. */
export const REVIEW_ROW_SELECT = {
  id: true,
  submissionId: true,
  reviewerId: true,
  status: true,
  summaryMd: true,
  rubricScores: true,
  submittedAt: true,
  createdAt: true,
} as const;

/** Shown when a reviewer's account no longer exists. */
export function unknownPerson(id: string): PersonRef {
  return { id, githubLogin: 'unknown', displayName: 'Không rõ', avatarUrl: null };
}

/** Stored JSON → typed scores; anything malformed is skipped instead of failing the page. */
export function parseStoredScores(json: unknown): RubricScoreView[] {
  if (!Array.isArray(json)) return [];
  const scores: RubricScoreView[] = [];
  for (const item of json) {
    const s = item as Partial<RubricScoreView> | null;
    if (
      s &&
      typeof s.criterion === 'string' &&
      typeof s.weight === 'number' &&
      typeof s.score === 'number'
    ) {
      scores.push({ criterion: s.criterion, weight: s.weight, score: s.score });
    }
  }
  return scores;
}

function isOutcome(status: string): status is ReviewOutcome {
  return status === 'approved' || status === 'changes_requested';
}

/** A finished review, or null for an open one (drafts never leave the server). */
export function toCompletedReview(row: ReviewRow, reviewer: PersonRef): CompletedReview | null {
  if (!isOutcome(row.status) || !row.submittedAt) return null;
  const rubricScores = parseStoredScores(row.rubricScores);
  return {
    id: row.id,
    outcome: row.status,
    summaryMd: row.summaryMd,
    rubricScores,
    rubricTotal: rubricTotal(rubricScores),
    reviewer,
    completedAt: row.submittedAt.toISOString(),
  };
}

export function toOpenReview(row: ReviewRow, reviewer: PersonRef): OpenReview {
  return {
    id: row.id,
    submissionId: row.submissionId,
    reviewer,
    claimedAt: row.createdAt.toISOString(),
  };
}

export function toReviewedSubmission(
  row: SubmissionForReview,
  review: CompletedReview | null,
): ReviewedSubmission {
  return {
    id: row.id,
    attempt: row.attempt,
    status: row.status,
    sourceUrl: row.sourceUrl,
    note: row.note,
    submittedAt: row.submittedAt.toISOString(),
    review,
  };
}

export function toQueueItem(input: {
  row: QueuedSubmission;
  member: PersonRef;
  openReview: OpenReview | null;
  now: Date;
  targetHours: number;
}): ReviewQueueItem {
  const { row, member, openReview, now, targetHours } = input;
  return {
    submissionId: row.id,
    attempt: row.attempt,
    submittedAt: row.submittedAt.toISOString(),
    ...waitingTime(row.submittedAt, now, targetHours),
    member,
    exercise: row.exercise,
    track: row.track,
    openReview,
  };
}
