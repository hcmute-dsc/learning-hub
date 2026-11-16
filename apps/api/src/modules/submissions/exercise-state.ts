import type { ExerciseState, SubmissionStatus } from '@hub/shared';

/**
 * How an exercise looks to one member (shared contract: EXERCISE_STATES).
 * Pure function so the rule is easy to read and test. The latest submission wins,
 * except that a completed exercise stays completed (a later failed retry does not undo it).
 */
export function exerciseState(input: {
  requiresReview: boolean;
  /** statuses of this member's submissions for the exercise, newest first */
  statuses: SubmissionStatus[];
  /** true when every prerequisite exercise is completed */
  prerequisitesMet: boolean;
}): ExerciseState {
  const { requiresReview, statuses, prerequisitesMet } = input;
  const isDone = (s: SubmissionStatus) => s === 'approved' || (s === 'passed' && !requiresReview);

  if (statuses.some(isDone)) return 'completed';
  if (!prerequisitesMet) return 'locked';

  const latest = statuses[0];
  switch (latest) {
    case undefined:
      return 'not_started';
    case 'submitted':
    case 'testing':
      return 'testing';
    case 'awaiting_review':
    case 'passed': // passed but requires review: waiting for a mentor
      return 'in_review';
    case 'changes_requested':
      return 'needs_changes';
    default: // failed, errored
      return 'attempted';
  }
}
