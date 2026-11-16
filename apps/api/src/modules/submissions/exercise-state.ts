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

export interface ExerciseStateWithLocks {
  state: ExerciseState;
  /** ids of prerequisites not completed yet; empty unless state = locked (ExerciseView.lockedBy) */
  lockedBy: string[];
}

/**
 * States for many exercises of one member, with their prerequisites. A prerequisite is
 * "met" when that exercise is completed. Evaluated one level deep: a prerequisite that
 * is itself locked is simply "not completed", which keeps the rule cheap and still
 * blocks the whole chain (completion of a chain happens in order anyway).
 */
export function statesWithPrerequisites(input: {
  ids: string[];
  /** exerciseId → ids of its prerequisite exercises */
  prerequisites: Map<string, string[]>;
  /** exerciseId → requires_review; missing counts as false */
  requiresReview: Map<string, boolean>;
  /** exerciseId → this member's submission statuses, newest first; missing = none */
  submissionsById: Map<string, SubmissionStatus[]>;
}): Map<string, ExerciseStateWithLocks> {
  const { ids, prerequisites, requiresReview, submissionsById } = input;

  const isCompleted = (id: string): boolean =>
    exerciseState({
      requiresReview: requiresReview.get(id) ?? false,
      statuses: submissionsById.get(id) ?? [],
      prerequisitesMet: true,
    }) === 'completed';

  const result = new Map<string, ExerciseStateWithLocks>();
  for (const id of ids) {
    const missing = (prerequisites.get(id) ?? []).filter((p) => !isCompleted(p));
    const state = exerciseState({
      requiresReview: requiresReview.get(id) ?? false,
      statuses: submissionsById.get(id) ?? [],
      prerequisitesMet: missing.length === 0,
    });
    result.set(id, { state, lockedBy: state === 'locked' ? missing : [] });
  }
  return result;
}
