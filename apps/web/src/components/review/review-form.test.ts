import { describe, expect, it } from 'vitest';
import {
  emptyScores,
  formatWaiting,
  liveTotal,
  parseScore,
  scoresToSend,
  validateReview,
} from './review-form';

const rubric = [
  { criterion: 'Schema', weight: 60 },
  { criterion: 'Query', weight: 40 },
];

describe('parseScore', () => {
  it('accepts whole numbers from 0 to the weight', () => {
    expect(parseScore('0', 10)).toBe(0);
    expect(parseScore(' 10 ', 10)).toBe(10);
  });

  it('rejects anything else', () => {
    expect(parseScore('', 10)).toBeNull();
    expect(parseScore('11', 10)).toBeNull();
    expect(parseScore('-1', 10)).toBeNull();
    expect(parseScore('2.5', 10)).toBeNull();
    expect(parseScore('abc', 10)).toBeNull();
  });
});

describe('liveTotal', () => {
  it('starts at zero and incomplete', () => {
    expect(liveTotal(rubric, emptyScores(rubric))).toEqual({
      total: 0,
      earned: 0,
      possible: 100,
      complete: false,
    });
  });

  it('adds valid scores as they are typed', () => {
    expect(liveTotal(rubric, { Schema: '45', Query: '' })).toMatchObject({
      total: 45,
      complete: false,
    });
    expect(liveTotal(rubric, { Schema: '45', Query: '40' })).toMatchObject({
      total: 85,
      complete: true,
    });
  });

  it('scales relative weights to 100', () => {
    const small = [
      { criterion: 'A', weight: 2 },
      { criterion: 'B', weight: 2 },
    ];
    expect(liveTotal(small, { A: '2', B: '1' }).total).toBe(75);
  });
});

describe('validateReview', () => {
  it('needs every criterion scored, an outcome, and a summary for changes', () => {
    expect(validateReview({ rubric, draft: { Schema: '10' }, outcome: null, summary: '' })).toEqual(
      {
        scores: expect.any(String),
        outcome: expect.any(String),
      },
    );
    expect(
      validateReview({
        rubric,
        draft: { Schema: '10', Query: '10' },
        outcome: 'changes_requested',
        summary: '  ',
      }),
    ).toEqual({ summary: expect.any(String) });
  });

  it('passes an approval without a summary', () => {
    expect(
      validateReview({
        rubric,
        draft: { Schema: '60', Query: '40' },
        outcome: 'approved',
        summary: '',
      }),
    ).toEqual({});
  });
});

describe('scoresToSend', () => {
  it('keeps rubric order', () => {
    expect(scoresToSend(rubric, { Query: '30', Schema: '50' })).toEqual([
      { criterion: 'Schema', score: 50 },
      { criterion: 'Query', score: 30 },
    ]);
  });
});

describe('formatWaiting', () => {
  it('reads naturally in Vietnamese', () => {
    expect(formatWaiting(0)).toBe('dưới 1 giờ');
    expect(formatWaiting(5)).toBe('5 giờ');
    expect(formatWaiting(48)).toBe('2 ngày');
    expect(formatWaiting(50)).toBe('2 ngày 2 giờ');
  });
});
