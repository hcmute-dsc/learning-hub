import { afterFailure, errorText, MAX_ATTEMPTS } from './outbox';

const NOW = new Date('2026-11-18T00:00:00Z');
const MIN = 60_000;

describe('afterFailure', () => {
  it('retries with exponential backoff', () => {
    const delay = (attempts: number) => {
      const next = afterFailure(attempts, NOW);
      if (next.status !== 'pending') throw new Error('expected a retry');
      return (next.nextAttemptAt.getTime() - NOW.getTime()) / MIN;
    };
    expect(delay(1)).toBe(1);
    expect(delay(2)).toBe(2);
    expect(delay(3)).toBe(4);
    expect(delay(MAX_ATTEMPTS - 1)).toBeLessThanOrEqual(6 * 60);
  });

  it(`gives up after ${MAX_ATTEMPTS} attempts`, () => {
    expect(afterFailure(MAX_ATTEMPTS, NOW)).toEqual({ status: 'failed' });
  });
});

describe('errorText', () => {
  it('keeps one short line', () => {
    const text = errorText(new Error(`line 1\nline 2 ${'x'.repeat(1000)}`));
    expect(text.startsWith('Error: line 1 line 2')).toBe(true);
    expect(text.length).toBe(500);
    expect(errorText('plain')).toBe('plain');
  });
});
