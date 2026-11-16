import { exerciseState } from './exercise-state';

const base = { requiresReview: false, statuses: [], prerequisitesMet: true } as const;

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
