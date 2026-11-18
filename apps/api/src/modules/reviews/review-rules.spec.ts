import { completeReviewSchema, reviewQueueQuerySchema, type Role } from '@hub/shared';
import { DomainError } from '../../common/errors';
import {
  assertCanClaim,
  assertCanComplete,
  assertCanRelease,
  countInactiveMentees,
  latestActivity,
  rubricTotal,
  scoreRubric,
  waitingTime,
} from './review-rules';

const mentor = { id: 'mentor-1', roles: ['member', 'mentor'] as Role[] };
const otherMentor = { id: 'mentor-2', roles: ['member', 'mentor'] as Role[] };
const admin = { id: 'admin-1', roles: ['member', 'admin'] as Role[] };

function statusOf(fn: () => void): number | null {
  try {
    fn();
    return null;
  } catch (err) {
    return err instanceof DomainError ? err.status : -1;
  }
}

describe('assertCanClaim', () => {
  const waiting = { userId: 'member-1', status: 'awaiting_review' as const };

  it('lets a mentor claim a waiting submission nobody holds', () => {
    expect(
      statusOf(() => assertCanClaim({ viewer: mentor, submission: waiting, openReview: null })),
    ).toBeNull();
  });

  it('forbids reviewing your own submission, admins included', () => {
    const own = { ...waiting, userId: admin.id };
    expect(
      statusOf(() => assertCanClaim({ viewer: admin, submission: own, openReview: null })),
    ).toBe(403);
  });

  it('is a conflict when the submission is not waiting for review', () => {
    const approved = { ...waiting, status: 'approved' as const };
    expect(
      statusOf(() => assertCanClaim({ viewer: mentor, submission: approved, openReview: null })),
    ).toBe(409);
  });

  it('is a conflict when someone already claimed it', () => {
    const openReview = { reviewerId: otherMentor.id };
    expect(
      statusOf(() => assertCanClaim({ viewer: mentor, submission: waiting, openReview })),
    ).toBe(409);
  });
});

describe('assertCanRelease', () => {
  const open = { reviewerId: mentor.id, status: 'in_progress' };

  it('lets the reviewer or an admin release an open review', () => {
    expect(statusOf(() => assertCanRelease(mentor, open))).toBeNull();
    expect(statusOf(() => assertCanRelease(admin, open))).toBeNull();
  });

  it('forbids another mentor', () => {
    expect(statusOf(() => assertCanRelease(otherMentor, open))).toBe(403);
  });

  it('cannot release a finished review', () => {
    expect(statusOf(() => assertCanRelease(mentor, { ...open, status: 'approved' }))).toBe(409);
  });
});

describe('assertCanComplete', () => {
  const open = { reviewerId: mentor.id, status: 'in_progress' };

  it('only the reviewer completes, not even an admin', () => {
    expect(statusOf(() => assertCanComplete(mentor, open))).toBeNull();
    expect(statusOf(() => assertCanComplete(admin, open))).toBe(403);
  });

  it('cannot complete twice', () => {
    expect(
      statusOf(() => assertCanComplete(mentor, { ...open, status: 'changes_requested' })),
    ).toBe(409);
  });
});

describe('scoreRubric', () => {
  const rubric = [
    { criterion: 'Schema đúng', weight: 60 },
    { criterion: 'Truy vấn rõ ràng', weight: 40 },
  ];

  it('returns scores in rubric order with weights copied in', () => {
    expect(
      scoreRubric(rubric, [
        { criterion: 'Truy vấn rõ ràng', score: 30 },
        { criterion: 'Schema đúng', score: 60 },
      ]),
    ).toEqual([
      { criterion: 'Schema đúng', weight: 60, score: 60 },
      { criterion: 'Truy vấn rõ ràng', weight: 40, score: 30 },
    ]);
  });

  it('accepts no scores at all', () => {
    expect(scoreRubric(rubric, undefined)).toEqual([]);
    expect(scoreRubric(rubric, [])).toEqual([]);
  });

  it('rejects a missing, duplicate, unknown or too-high score with 422', () => {
    expect(statusOf(() => scoreRubric(rubric, [{ criterion: 'Schema đúng', score: 10 }]))).toBe(
      422,
    );
    expect(
      statusOf(() =>
        scoreRubric(rubric, [
          { criterion: 'Schema đúng', score: 10 },
          { criterion: 'Schema đúng', score: 20 },
          { criterion: 'Truy vấn rõ ràng', score: 10 },
        ]),
      ),
    ).toBe(422);
    expect(
      statusOf(() =>
        scoreRubric(rubric, [
          { criterion: 'Schema đúng', score: 10 },
          { criterion: 'Truy vấn rõ ràng', score: 10 },
          { criterion: 'Khác', score: 1 },
        ]),
      ),
    ).toBe(422);
    expect(
      statusOf(() =>
        scoreRubric(rubric, [
          { criterion: 'Schema đúng', score: 61 },
          { criterion: 'Truy vấn rõ ràng', score: 10 },
        ]),
      ),
    ).toBe(422);
  });

  it('rejects scores for an exercise without a rubric', () => {
    expect(statusOf(() => scoreRubric([], [{ criterion: 'x', score: 1 }]))).toBe(422);
  });
});

describe('rubricTotal', () => {
  it('is earned / possible on a 0–100 scale', () => {
    expect(
      rubricTotal([
        { weight: 60, score: 60 },
        { weight: 40, score: 30 },
      ]),
    ).toBe(90);
    // Relative weights 2 + 1 + 1: 3 of 4 points → 75.
    expect(
      rubricTotal([
        { weight: 2, score: 2 },
        { weight: 1, score: 1 },
        { weight: 1, score: 0 },
      ]),
    ).toBe(75);
  });

  it('is null when nothing was scored', () => {
    expect(rubricTotal([])).toBeNull();
  });
});

describe('waitingTime', () => {
  const submitted = new Date('2026-11-14T00:00:00Z');

  it('counts whole hours and compares with the target', () => {
    expect(waitingTime(submitted, new Date('2026-11-17T00:30:00Z'), 72)).toEqual({
      hoursWaiting: 72,
      overTarget: true,
    });
    expect(waitingTime(submitted, new Date('2026-11-16T23:59:00Z'), 72)).toEqual({
      hoursWaiting: 71,
      overTarget: false,
    });
  });

  it('never goes negative when clocks disagree', () => {
    expect(waitingTime(submitted, new Date('2026-11-13T00:00:00Z'), 72).hoursWaiting).toBe(0);
  });
});

describe('completeReviewSchema (shared)', () => {
  it('requires a summary when asking for changes, not when approving', () => {
    expect(completeReviewSchema.safeParse({ outcome: 'changes_requested' }).success).toBe(false);
    expect(
      completeReviewSchema.safeParse({ outcome: 'changes_requested', summaryMd: '   ' }).success,
    ).toBe(false);
    expect(completeReviewSchema.parse({ outcome: 'approved' })).toEqual({
      outcome: 'approved',
      summaryMd: '',
    });
  });

  it('limits the summary length', () => {
    const long = 'x'.repeat(5001);
    expect(completeReviewSchema.safeParse({ outcome: 'approved', summaryMd: long }).success).toBe(
      false,
    );
  });
});

describe('reviewQueueQuerySchema (shared)', () => {
  it('accepts no filter, a track slug and a GitHub login', () => {
    expect(reviewQueueQuerySchema.parse({})).toEqual({});
    expect(reviewQueueQuerySchema.parse({ track: 'sql-30-days', mentee: 'Tien-NHM' })).toEqual({
      track: 'sql-30-days',
      mentee: 'Tien-NHM',
    });
  });

  it('rejects malformed values and unknown parameters', () => {
    for (const bad of [
      { track: 'SQL 30' },
      { track: '-sql' },
      { mentee: '-bad' },
      { mentee: 'a--b' },
      { mentee: 'a'.repeat(40) },
      { status: 'approved' },
    ]) {
      expect(reviewQueueQuerySchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe('latestActivity', () => {
  it('keeps the latest date per user and ignores nulls', () => {
    const map = latestActivity(
      [
        { userId: 'a', at: new Date('2026-11-01') },
        { userId: 'b', at: null },
      ],
      [
        { userId: 'a', at: new Date('2026-11-10') },
        { userId: 'a', at: new Date('2026-11-05') },
      ],
    );
    expect(map.get('a')).toEqual(new Date('2026-11-10'));
    expect(map.has('b')).toBe(false);
  });
});

describe('countInactiveMentees', () => {
  const now = new Date('2026-11-18T12:00:00Z');
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

  it('counts mentees whose latest activity is older than the limit', () => {
    const mentees = [
      { menteeId: 'active', startedAt: daysAgo(60) },
      { menteeId: 'quiet', startedAt: daysAgo(60) },
      { menteeId: 'never', startedAt: daysAgo(30) },
    ];
    const last = new Map([
      ['active', daysAgo(3)],
      ['quiet', daysAgo(15)],
    ]);
    expect(countInactiveMentees(mentees, last, now, 14)).toBe(2);
  });

  it('does not flag a mentee assigned recently with no activity yet', () => {
    expect(
      countInactiveMentees([{ menteeId: 'new', startedAt: daysAgo(2) }], new Map(), now, 14),
    ).toBe(0);
  });

  it('treats exactly the limit as still active and no date at all as inactive', () => {
    expect(
      countInactiveMentees([{ menteeId: 'x', startedAt: daysAgo(14) }], new Map(), now, 14),
    ).toBe(0);
    expect(countInactiveMentees([{ menteeId: 'y', startedAt: null }], new Map(), now, 14)).toBe(1);
  });

  it('counts a mentee with two active assignments once', () => {
    const mentees = [
      { menteeId: 'm', startedAt: daysAgo(40) },
      { menteeId: 'm', startedAt: daysAgo(30) },
    ];
    expect(countInactiveMentees(mentees, new Map(), now, 14)).toBe(1);
  });

  it('is 0 with no mentees', () => {
    expect(countInactiveMentees([], new Map(), now, 14)).toBe(0);
  });
});
