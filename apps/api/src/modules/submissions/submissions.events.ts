/** Domain events published by the submissions module (BACKEND-DESIGN §5). */
export const SubmissionEvents = {
  /** every new submission; assessments (E6) will start checks for code submissions */
  Created: 'submission.created',
  /** a submission that completes its exercise right away (quiz passed, self-check) */
  Passed: 'submission.passed',
  /** a project waits in the mentor review queue (notifications later) */
  AwaitingReview: 'submission.awaiting_review',
} as const;

export interface SubmissionEvent {
  submissionId: string;
  userId: string;
  exerciseId: string;
  status: string;
}
