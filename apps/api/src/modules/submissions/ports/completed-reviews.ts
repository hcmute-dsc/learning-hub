import type { CompletedReview } from '@hub/shared';

/**
 * Port owned by the submissions module: the finished mentor review of each submission,
 * shown to the member with their attempts. The reviews module owns the `reviews` table
 * and binds this port (reviews/review-records.module.ts), because reviews depends on
 * submissions and never the other way round.
 */
export interface CompletedReviews {
  /** submissionId → its finished review. In-progress reviews are never returned. */
  forSubmissions(submissionIds: string[]): Promise<Map<string, CompletedReview>>;
}

export const COMPLETED_REVIEWS = Symbol('COMPLETED_REVIEWS');
