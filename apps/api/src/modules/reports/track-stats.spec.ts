import type { MemberFact, ReviewFact } from './report-stats';
import {
  canViewTrackStats,
  checkOutcome,
  funnel,
  hardestByFirstAttempt,
  inactiveLearners,
  recentWeeks,
  trackTotals,
  waitingReviews,
  weekly,
  type OutlineModule,
} from './track-stats';

const NOW = new Date('2026-11-25T05:00:00Z'); // Wednesday 25/11/2026, 12:00 in Vietnam
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

// Ids are uuids in the database; short readable ones are enough here.
const OUTLINE: OutlineModule[] = [
  {
    slug: 'select',
    title: 'SELECT',
    lessons: [
      { id: 'l1', title: 'Bảng là gì' },
      { id: 'l2', title: 'SELECT cột' },
    ],
    exercises: [
      { id: 'x1', title: 'Quiz SELECT', type: 'quiz' },
      { id: 'x2', title: 'Tự kiểm tra', type: 'self_check' },
    ],
  },
  {
    slug: 'join',
    title: 'JOIN',
    lessons: [{ id: 'l3', title: 'INNER JOIN' }],
    exercises: [{ id: 'x3', title: 'Viết JOIN', type: 'code' }],
  },
  { slug: 'empty', title: 'Sắp có', lessons: [], exercises: [] },
];

function fact(over: Partial<MemberFact> = {}): MemberFact {
  return {
    userId: 'u1',
    githubLogin: 'an',
    trackId: 't-sql',
    trackSlug: 'sql-30-days',
    trackTitle: 'SQL 30 ngày',
    cohort: null,
    enrolledAt: daysAgo(30),
    completedAt: null,
    lessonsInPeriod: 0,
    lessonsDone: 0,
    lessonsTotal: 3,
    exercisesInPeriod: 0,
    exercisesDone: 0,
    exercisesTotal: 3,
    awaitingReview: 0,
    activeInPeriod: false,
    lastActiveAt: null,
    ...over,
  };
}

describe('canViewTrackStats', () => {
  it('lets admins and mentors see every track, like the review queue', () => {
    expect(canViewTrackStats(['member', 'admin'])).toBe(true);
    expect(canViewTrackStats(['member', 'mentor'])).toBe(true);
  });

  it('never lets a member or a content maintainer in', () => {
    expect(canViewTrackStats(['member'])).toBe(false);
    expect(canViewTrackStats(['member', 'content_maintainer'])).toBe(false);
  });
});

describe('trackTotals', () => {
  it('takes the report numbers that the page shows', () => {
    const review: ReviewFact = { userId: 'u1', trackId: 't-sql', reviewerId: 'm', hours: 6 };
    const totals = trackTotals(
      [
        fact({ activeInPeriod: true, awaitingReview: 2 }),
        fact({ userId: 'u2', completedAt: daysAgo(1) }),
        fact({ userId: 'u3' }),
      ],
      [review, { ...review, hours: 10 }, { ...review, userId: 'staff', hours: 99 }],
    );
    expect(totals).toEqual({
      enrolled: 3,
      active: 1,
      completed: 1,
      completionRate: 33,
      awaitingReview: 2,
      reviewsDone: 2,
      reviewHoursMedian: 8,
    });
  });
});

describe('funnel', () => {
  it('counts learners per item in reading order, and per module only when all items are done', () => {
    const done = [
      // an: all of module 1, and the first lesson of module 2
      ...['l1', 'l2', 'x1', 'x2', 'l3'].map((itemId) => ({ userId: 'an', itemId })),
      // binh: module 1 without the self-check
      ...['l1', 'l2', 'x1'].map((itemId) => ({ userId: 'binh', itemId })),
      { userId: 'chi', itemId: 'l1' },
      { userId: 'chi', itemId: 'l1' }, // duplicates count once
      { userId: 'chi', itemId: 'archived-lesson' }, // not in the outline: ignored
    ];
    const result = funnel(OUTLINE, done);

    expect(result.map((m) => [m.slug, m.completed])).toEqual([
      ['select', 1],
      ['join', 0],
      ['empty', 0],
    ]);
    expect(result[0].items).toEqual([
      { kind: 'lesson', id: 'l1', title: 'Bảng là gì', completed: 3 },
      { kind: 'lesson', id: 'l2', title: 'SELECT cột', completed: 2 },
      { kind: 'exercise', id: 'x1', title: 'Quiz SELECT', completed: 2 },
      { kind: 'exercise', id: 'x2', title: 'Tự kiểm tra', completed: 1 },
    ]);
    expect(result[1].items.map((i) => i.completed)).toEqual([1, 0]);
    expect(result[2].items).toEqual([]);
  });

  it('shows the outline with zeros when nobody has done anything', () => {
    const result = funnel(OUTLINE, []);
    expect(result.flatMap((m) => m.items.map((i) => i.completed))).toEqual([0, 0, 0, 0, 0, 0]);
  });
});

describe('checkOutcome', () => {
  it('reads the automatic result of an attempt', () => {
    expect(checkOutcome('failed')).toBe('failed');
    expect(checkOutcome('passed')).toBe('passed');
    // a code exercise that passed its checks and went on to review
    expect(checkOutcome('awaiting_review')).toBe('passed');
    expect(checkOutcome('changes_requested')).toBe('passed');
    expect(checkOutcome('approved')).toBe('passed');
    // no result yet, or the checker broke
    expect(checkOutcome('submitted')).toBeNull();
    expect(checkOutcome('testing')).toBeNull();
    expect(checkOutcome('errored')).toBeNull();
  });
});

describe('hardestByFirstAttempt', () => {
  it('ranks auto-checked exercises by first-attempt fail rate', () => {
    const attempts = [
      // x1 (quiz): 1 of 4 failed = 25%
      { exerciseId: 'x1', status: 'failed' as const },
      { exerciseId: 'x1', status: 'passed' as const },
      { exerciseId: 'x1', status: 'passed' as const },
      { exerciseId: 'x1', status: 'passed' as const },
      // x3 (code): 1 of 2 with a result failed = 50%; the waiting one has no result
      { exerciseId: 'x3', status: 'failed' as const },
      { exerciseId: 'x3', status: 'awaiting_review' as const },
      { exerciseId: 'x3', status: 'submitted' as const },
      // x2 (self-check) is never "failed": left out
      { exerciseId: 'x2', status: 'passed' as const },
    ];
    expect(hardestByFirstAttempt(OUTLINE, attempts)).toEqual([
      {
        id: 'x3',
        title: 'Viết JOIN',
        moduleTitle: 'JOIN',
        firstAttempts: 2,
        failed: 1,
        failRate: 50,
      },
      {
        id: 'x1',
        title: 'Quiz SELECT',
        moduleTitle: 'SELECT',
        firstAttempts: 4,
        failed: 1,
        failRate: 25,
      },
    ]);
  });

  it('breaks ties by the number of attempts, then content order, and keeps the top rows', () => {
    const attempts = [
      { exerciseId: 'x1', status: 'passed' as const },
      { exerciseId: 'x3', status: 'passed' as const },
      { exerciseId: 'x3', status: 'passed' as const },
    ];
    expect(hardestByFirstAttempt(OUTLINE, attempts).map((x) => x.id)).toEqual(['x3', 'x1']);
    expect(hardestByFirstAttempt(OUTLINE, attempts, 1).map((x) => x.id)).toEqual(['x3']);
    expect(hardestByFirstAttempt(OUTLINE, [])).toEqual([]);
  });
});

describe('waitingReviews', () => {
  it('adds the hours each submission has waited', () => {
    const submittedAt = new Date(NOW.getTime() - 50.25 * 3_600_000);
    expect(
      waitingReviews(
        [
          {
            submissionId: 's1',
            exerciseId: 'x3',
            exerciseTitle: 'Viết JOIN',
            githubLogin: 'an',
            submittedAt,
          },
        ],
        NOW,
      ),
    ).toEqual([
      {
        submissionId: 's1',
        exerciseId: 'x3',
        exerciseTitle: 'Viết JOIN',
        githubLogin: 'an',
        submittedAt: submittedAt.toISOString(),
        hoursWaiting: 50.3,
      },
    ]);
  });
});

describe('recentWeeks', () => {
  it('gives the Mondays of the last weeks in Vietnam time, this week last', () => {
    expect(recentWeeks(NOW, 3)).toEqual(['2026-11-09', '2026-11-16', '2026-11-23']);
    expect(recentWeeks(NOW)).toHaveLength(12);
  });

  it('uses the Vietnam day: Sunday 23:30 UTC is already Monday in Vietnam', () => {
    expect(recentWeeks(new Date('2026-11-22T17:30:00Z'), 1)).toEqual(['2026-11-23']);
    expect(recentWeeks(new Date('2026-11-22T16:30:00Z'), 1)).toEqual(['2026-11-16']);
  });
});

describe('weekly', () => {
  const weeks = ['2026-11-16', '2026-11-23'];

  it('counts enrollments and active learners (once per week) by Vietnam week', () => {
    const result = weekly(
      weeks,
      [
        { enrolledAt: new Date('2026-11-16T01:00:00Z') },
        // Sunday 22/11 23:00 in Vietnam: still the week of 16/11
        { enrolledAt: new Date('2026-11-22T16:00:00Z') },
        // Monday 23/11 00:30 in Vietnam
        { enrolledAt: new Date('2026-11-22T17:30:00Z') },
        // before the chart: ignored
        { enrolledAt: new Date('2026-10-01T00:00:00Z') },
      ],
      [
        { userId: 'an', at: new Date('2026-11-17T03:00:00Z') },
        { userId: 'an', at: new Date('2026-11-18T03:00:00Z') },
        { userId: 'binh', at: new Date('2026-11-18T03:00:00Z') },
        { userId: 'an', at: new Date('2026-11-24T03:00:00Z') },
      ],
    );
    expect(result).toEqual([
      { weekStart: '2026-11-16', enrolled: 2, active: 2 },
      { weekStart: '2026-11-23', enrolled: 1, active: 1 },
    ]);
  });

  it('keeps empty weeks so the chart has every bar', () => {
    expect(weekly(weeks, [], [])).toEqual([
      { weekStart: '2026-11-16', enrolled: 0, active: 0 },
      { weekStart: '2026-11-23', enrolled: 0, active: 0 },
    ]);
  });
});

describe('inactiveLearners', () => {
  it('lists learners quiet for 7 days or more, never active first, then the oldest', () => {
    const result = inactiveLearners(
      [
        fact({ githubLogin: 'an', lastActiveAt: daysAgo(10), lessonsDone: 2, exercisesDone: 1 }),
        fact({ githubLogin: 'binh', lastActiveAt: null }),
        fact({ githubLogin: 'chi', lastActiveAt: daysAgo(6) }), // active this week
        fact({ githubLogin: 'dung', lastActiveAt: daysAgo(30), completedAt: daysAgo(30) }), // done
        fact({ githubLogin: 'em', lastActiveAt: daysAgo(7) }), // exactly 7 days
        fact({
          githubLogin: 'giang',
          lastActiveAt: daysAgo(20),
          lessonsTotal: 0,
          exercisesTotal: 0,
        }),
      ],
      NOW,
    );
    expect(result.total).toBe(4);
    expect(result.learners.map((l) => l.githubLogin)).toEqual(['binh', 'giang', 'an', 'em']);
    expect(result.learners[2]).toEqual({
      githubLogin: 'an',
      enrolledAt: daysAgo(30).toISOString(),
      itemsDone: 3,
      itemsTotal: 6,
      progress: 50,
      lastActiveAt: daysAgo(10).toISOString(),
    });
    expect(result.learners[1].progress).toBe(0); // an empty track never divides by zero
  });

  it('gives a learner who never started 7 days from enrolling before listing them', () => {
    const result = inactiveLearners(
      [
        fact({ githubLogin: 'moi', enrolledAt: daysAgo(2), lastActiveAt: null }),
        fact({ githubLogin: 'vua-du', enrolledAt: daysAgo(7), lastActiveAt: null }),
      ],
      NOW,
    );
    expect(result.total).toBe(1);
    expect(result.learners.map((l) => l.githubLogin)).toEqual(['vua-du']);
  });

  it('keeps the exact total when the list is cut', () => {
    const facts = ['a', 'b', 'c'].map((githubLogin) => fact({ githubLogin }));
    const result = inactiveLearners(facts, NOW, 2);
    expect(result.total).toBe(3);
    expect(result.learners.map((l) => l.githubLogin)).toEqual(['a', 'b']);
  });
});
