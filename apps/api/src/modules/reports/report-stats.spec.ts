import {
  anonymousName,
  groupStats,
  median,
  memberRows,
  percent,
  stats,
  type MemberFact,
  type ReviewFact,
} from './report-stats';

const SQL = { trackId: 't-sql', trackSlug: 'sql-30-days', trackTitle: 'SQL 30 ngày' };
const GIT = { trackId: 't-git', trackSlug: 'git-co-ban', trackTitle: 'Git cơ bản' };

function fact(over: Partial<MemberFact> = {}): MemberFact {
  return {
    userId: 'u1',
    githubLogin: 'an',
    ...SQL,
    cohort: 'sql-2026',
    enrolledAt: new Date('2026-11-23T02:00:00Z'),
    completedAt: null,
    lessonsInPeriod: 0,
    lessonsDone: 0,
    lessonsTotal: 30,
    exercisesInPeriod: 0,
    exercisesDone: 0,
    exercisesTotal: 33,
    awaitingReview: 0,
    activeInPeriod: false,
    lastActiveAt: null,
    ...over,
  };
}

const review = (over: Partial<ReviewFact> = {}): ReviewFact => ({
  userId: 'u1',
  trackId: SQL.trackId,
  reviewerId: 'mentor-1',
  hours: 10,
  ...over,
});

describe('median and percent', () => {
  it('takes the middle value, or the mean of the two middle ones', () => {
    expect(median([])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('rounds to a whole percent and never divides by zero', () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(2, 3)).toBe(67);
    expect(percent(0, 0)).toBe(0);
  });
});

describe('stats', () => {
  it('counts nothing for no learners', () => {
    expect(stats([], [review()])).toEqual({
      enrolled: 0,
      active: 0,
      lessonsCompleted: 0,
      exercisesCompleted: 0,
      atLeastFive: 0,
      atLeastFiveRate: 0,
      completedTrack: 0,
      completionRate: 0,
      awaitingReview: 0,
      reviewsDone: 0,
      reviewHoursMedian: null,
      reviewHoursMax: null,
      reviewers: 0,
    });
  });

  it('adds up the period counts and the trial metrics M1–M8', () => {
    const facts = [
      fact({ userId: 'u1', lessonsInPeriod: 4, exercisesInPeriod: 2, exercisesDone: 6 }),
      fact({ userId: 'u2', activeInPeriod: true, lessonsInPeriod: 1, exercisesDone: 5 }),
      fact({ userId: 'u3', activeInPeriod: true, awaitingReview: 1, completedAt: new Date() }),
      fact({ userId: 'u4', exercisesDone: 4 }),
    ];
    const reviews = [
      review({ userId: 'u1', hours: 2, reviewerId: 'm1' }),
      review({ userId: 'u2', hours: 30.04, reviewerId: 'm1' }),
      review({ userId: 'u3', hours: 5, reviewerId: 'm2' }),
    ];
    expect(stats(facts, reviews)).toEqual({
      enrolled: 4,
      active: 2,
      lessonsCompleted: 5,
      exercisesCompleted: 2,
      atLeastFive: 2,
      atLeastFiveRate: 50,
      completedTrack: 1,
      completionRate: 25,
      awaitingReview: 1,
      reviewsDone: 3,
      reviewHoursMedian: 5,
      reviewHoursMax: 30,
      reviewers: 2,
    });
  });

  it('counts a person once across tracks, and their exercises together', () => {
    const facts = [
      fact({ userId: 'u1', activeInPeriod: true, exercisesDone: 3 }),
      fact({ userId: 'u1', ...GIT, activeInPeriod: true, exercisesDone: 2 }),
    ];
    const s = stats(facts, []);
    expect(s).toMatchObject({ enrolled: 1, active: 1, atLeastFive: 1, atLeastFiveRate: 100 });
    // completion is per enrollment
    expect(stats([facts[0], { ...facts[1], completedAt: new Date() }], []).completionRate).toBe(50);
  });

  it("ignores reviews of people or tracks that are not in the report (admins' tests)", () => {
    const s = stats(
      [fact()],
      [review(), review({ userId: 'admin' }), review({ trackId: GIT.trackId })],
    );
    expect(s.reviewsDone).toBe(1);
  });
});

describe('groupStats', () => {
  it('gives one row per track and cohort, sorted, without a cohort last', () => {
    const groups = groupStats(
      [
        fact({ userId: 'u1', cohort: null }),
        fact({ userId: 'u2', cohort: 'sql-2026' }),
        fact({ userId: 'u3', cohort: 'sql-2026', activeInPeriod: true }),
        fact({ userId: 'u1', ...GIT, cohort: null }),
      ],
      [review({ userId: 'u3' })],
    );
    expect(
      groups.map((g) => [g.track.slug, g.cohort, g.enrolled, g.active, g.reviewsDone]),
    ).toEqual([
      ['git-co-ban', null, 1, 0, 0],
      ['sql-30-days', 'sql-2026', 2, 1, 1],
      ['sql-30-days', null, 1, 0, 0],
    ]);
  });
});

describe('memberRows', () => {
  const facts = [
    fact({ userId: 'u2', githubLogin: 'binh', lastActiveAt: new Date('2026-11-24T03:00:00Z') }),
    fact({ userId: 'u1', githubLogin: 'an', ...GIT }),
    fact({ userId: 'u1', githubLogin: 'an' }),
  ];

  it('lists each enrollment with its login and ISO dates, in table order', () => {
    const rows = memberRows(facts);
    expect(rows.map((r) => [r.githubLogin, r.trackSlug])).toEqual([
      ['an', 'git-co-ban'],
      ['an', 'sql-30-days'],
      ['binh', 'sql-30-days'],
    ]);
    expect(rows[2]).toMatchObject({
      enrolledAt: '2026-11-23T02:00:00.000Z',
      lastActiveAt: '2026-11-24T03:00:00.000Z',
      completedAt: null,
    });
    expect(Object.keys(rows[0])).not.toContain('userId');
  });

  it('replaces logins with one alias per person when anonymized', () => {
    const rows = memberRows(facts, true);
    expect(rows.map((r) => r.githubLogin)).toEqual([
      anonymousName(1),
      anonymousName(1),
      anonymousName(2),
    ]);
    expect(anonymousName(7)).toBe('Người học 007');
    expect(JSON.stringify(rows)).not.toMatch(/"(an|binh)"/);
  });
});
