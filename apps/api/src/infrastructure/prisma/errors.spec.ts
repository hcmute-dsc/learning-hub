import { isUniqueViolation } from './errors';

describe('isUniqueViolation', () => {
  it('detects any P2002 without a field', () => {
    expect(isUniqueViolation({ code: 'P2002' })).toBe(true);
    expect(isUniqueViolation({ code: 'P2025' })).toBe(false);
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });

  it('with a field, matches only the unique key that mentions it', () => {
    expect(
      isUniqueViolation(
        { code: 'P2002', meta: { target: ['user_id', 'exercise_id', 'attempt'] } },
        'attempt',
      ),
    ).toBe(true);
    expect(
      isUniqueViolation(
        { code: 'P2002', meta: { target: 'submissions_user_id_exercise_id_attempt_key' } },
        'attempt',
      ),
    ).toBe(true);
    expect(
      isUniqueViolation(
        { code: 'P2002', meta: { target: 'submissions_idempotency_uq' } },
        'attempt',
      ),
    ).toBe(false);
  });
});
