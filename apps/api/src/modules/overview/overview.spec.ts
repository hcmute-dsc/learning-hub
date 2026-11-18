import { activitySince, toOverview, type OverviewFacts } from './overview';

const now = new Date('2026-11-18T12:00:00Z');

const facts = (over: Partial<OverviewFacts> = {}): OverviewFacts => ({
  members: { pending: 2, active: 40, suspended: 1 },
  content: { published: null, drafts: 0 },
  backlog: { waiting: 0, oldestSubmittedAt: null },
  signedIn: 12,
  submissions: 30,
  adminActions: 5,
  ...over,
});

describe('activitySince', () => {
  it('goes back exactly seven days by default', () => {
    expect(activitySince(now).toISOString()).toBe('2026-11-11T12:00:00.000Z');
    expect(activitySince(now, 1).toISOString()).toBe('2026-11-17T12:00:00.000Z');
  });
});

describe('toOverview', () => {
  it('passes the counts through', () => {
    const o = toOverview(facts(), now, 72);
    expect(o.members).toEqual({ pending: 2, active: 40, suspended: 1 });
    expect(o.activity).toEqual({ days: 7, signedIn: 12, submissions: 30, adminActions: 5 });
  });

  it('has no published version or oldest wait when there is none', () => {
    const o = toOverview(facts(), now, 72);
    expect(o.content).toEqual({ published: null, drafts: 0 });
    expect(o.reviews).toEqual({ waiting: 0, oldest: null, targetHours: 72 });
  });

  it('shows the live version with ISO dates', () => {
    const o = toOverview(
      facts({
        content: {
          published: { id: 'v1', commitSha: 'a'.repeat(40), publishedAt: now },
          drafts: 2,
        },
      }),
      now,
      72,
    );
    expect(o.content).toEqual({
      published: { id: 'v1', commitSha: 'a'.repeat(40), publishedAt: now.toISOString() },
      drafts: 2,
    });
  });

  it('marks the oldest submission over target with the review-queue rule', () => {
    const submitted = new Date('2026-11-15T11:00:00Z'); // 73 h before now
    const o = toOverview(facts({ backlog: { waiting: 3, oldestSubmittedAt: submitted } }), now, 72);
    expect(o.reviews).toEqual({
      waiting: 3,
      oldest: { submittedAt: submitted.toISOString(), hoursWaiting: 73, overTarget: true },
      targetHours: 72,
    });
  });

  it('is not over target inside the window', () => {
    const submitted = new Date('2026-11-18T02:00:00Z');
    const o = toOverview(facts({ backlog: { waiting: 1, oldestSubmittedAt: submitted } }), now, 72);
    expect(o.reviews.oldest).toMatchObject({ hoursWaiting: 10, overTarget: false });
  });
});
