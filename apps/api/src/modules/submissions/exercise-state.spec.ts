import type { SubmissionStatus } from '@hub/shared';
import { exerciseState, statesWithPrerequisites } from './exercise-state';

const base = { requiresReview: false, statuses: [] as SubmissionStatus[], prerequisitesMet: true };

describe('exerciseState', () => {
  it('is not_started without submissions, locked when a prerequisite is missing', () => {
    expect(exerciseState({ ...base })).toBe('not_started');
    expect(exerciseState({ ...base, prerequisitesMet: false })).toBe('locked');
  });

  it('completes on passed (no review) or approved, and stays completed after a failed retry', () => {
    expect(exerciseState({ ...base, statuses: ['passed'] })).toBe('completed');
    expect(exerciseState({ ...base, statuses: ['failed', 'passed'] })).toBe('completed');
    expect(exerciseState({ ...base, requiresReview: true, statuses: ['approved'] })).toBe(
      'completed',
    );
  });

  it('a completed exercise is not shown as locked even if prerequisites changed later', () => {
    expect(exerciseState({ ...base, statuses: ['passed'], prerequisitesMet: false })).toBe(
      'completed',
    );
  });

  it('maps the latest submission otherwise', () => {
    expect(exerciseState({ ...base, statuses: ['failed'] })).toBe('attempted');
    expect(exerciseState({ ...base, statuses: ['submitted'] })).toBe('testing');
    expect(exerciseState({ ...base, requiresReview: true, statuses: ['awaiting_review'] })).toBe(
      'in_review',
    );
    expect(exerciseState({ ...base, requiresReview: true, statuses: ['passed'] })).toBe(
      'in_review',
    );
    expect(exerciseState({ ...base, requiresReview: true, statuses: ['changes_requested'] })).toBe(
      'needs_changes',
    );
  });
});

describe('statesWithPrerequisites', () => {
  // b needs a; c needs b (a chain)
  const prerequisites = new Map<string, string[]>([
    ['a', []],
    ['b', ['a']],
    ['c', ['b']],
  ]);
  const run = (submissionsById: Map<string, SubmissionStatus[]>) =>
    statesWithPrerequisites({
      ids: ['a', 'b', 'c'],
      prerequisites,
      requiresReview: new Map(),
      submissionsById,
    });

  it('locks an exercise whose prerequisite is missing and names it in lockedBy', () => {
    const states = run(new Map<string, SubmissionStatus[]>());
    expect(states.get('a')).toEqual({ state: 'not_started', lockedBy: [] });
    expect(states.get('b')).toEqual({ state: 'locked', lockedBy: ['a'] });
  });

  it('opens an exercise once its prerequisite is completed', () => {
    const states = run(new Map<string, SubmissionStatus[]>([['a', ['passed']]]));
    expect(states.get('b')).toEqual({ state: 'not_started', lockedBy: [] });
  });

  it('a prerequisite that is itself locked still locks (one level deep)', () => {
    const states = run(new Map<string, SubmissionStatus[]>());
    expect(states.get('c')).toEqual({ state: 'locked', lockedBy: ['b'] });
  });

  it('a completed exercise has no lockedBy even if a prerequisite is missing', () => {
    const states = run(new Map<string, SubmissionStatus[]>([['b', ['passed']]]));
    expect(states.get('b')).toEqual({ state: 'completed', lockedBy: [] });
  });
});
