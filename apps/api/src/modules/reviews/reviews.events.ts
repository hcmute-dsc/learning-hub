/**
 * Domain events published by the reviews module (BACKEND-DESIGN §5, E7).
 * Agreed before the E7/E9/E10 work split (17/11/2026): notifications and audit listen
 * to these names, so change them only together with their listeners.
 */
export const ReviewEvents = {
  /** a mentor took a submission from the queue ("Nhận review") */
  Claimed: 'review.claimed',
  /** a mentor gave up a claimed review; the submission is back in the queue */
  Released: 'review.released',
  /** a mentor finished the review: approved or changes requested */
  Completed: 'review.completed',
} as const;

export type ReviewOutcome = 'approved' | 'changes_requested';

export interface ReviewClaimedEvent {
  reviewId: string;
  submissionId: string;
  reviewerId: string;
}

export interface ReviewCompletedEvent {
  reviewId: string;
  submissionId: string;
  exerciseId: string;
  /** the member who submitted */
  memberId: string;
  reviewerId: string;
  outcome: ReviewOutcome;
}
