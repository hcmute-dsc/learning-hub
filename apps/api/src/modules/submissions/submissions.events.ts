/** Domain events published by the submissions module (BACKEND-DESIGN §5). */
export const SubmissionEvents = {
  /** every new submission; assessments (E6) will start checks for code submissions */
  Created: 'submission.created',
  /** a submission that completes its exercise right away (quiz passed, self-check) */
  Passed: 'submission.passed',
  /** a project waits in the mentor review queue (notifications later) */
  AwaitingReview: 'submission.awaiting_review',
  /** a mentor approved it (E7): the exercise is completed, like Passed */
  Approved: 'submission.approved',
  /** a mentor asked for changes (E7): the member submits again */
  ChangesRequested: 'submission.changes_requested',
} as const;

export interface SubmissionEvent {
  submissionId: string;
  userId: string;
  exerciseId: string;
  status: string;
}
