import type { PersonRef } from '@hub/shared';
import type { AuthUser } from '../../common/auth.decorators';
import { MenteeActivity } from './mentee-activity';
import { ReviewsService } from './reviews.service';

const now = new Date('2026-11-18T12:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);
const viewer = { id: 'mentor-1', roles: ['member', 'mentor'] } as unknown as AuthUser;
const person = (id: string): PersonRef => ({
  id,
  githubLogin: id,
  displayName: id.toUpperCase(),
  avatarUrl: null,
});

function row(id: string, userId: string, waitedHours: number) {
  return {
    id,
    userId,
    exerciseId: 'ex-1',
    attempt: 1,
    status: 'awaiting_review',
    sourceUrl: null,
    note: null,
    submittedAt: hoursAgo(waitedHours),
    exercise: { id: 'ex-1', title: 'Dự án cuối khóa' },
    track: { slug: 'sql-30-days', title: 'SQL 30 ngày' },
  };
}

function setup(opts: {
  rows: ReturnType<typeof row>[];
  counts: { waiting: number; claimed: number; overTarget: number };
  mentorship?: { mentees: PersonRef[]; inactive: number | null };
}) {
  const submissions = {
    awaitingReview: jest.fn().mockResolvedValue(opts.rows),
    awaitingReviewCounts: jest.fn().mockResolvedValue(opts.counts),
  };
  const catalog = {
    activeTracks: jest.fn().mockResolvedValue([{ slug: 'sql-30-days', title: 'SQL 30 ngày' }]),
  };
  const mentees = {
    forMentor: jest.fn().mockResolvedValue(opts.mentorship ?? { mentees: [], inactive: null }),
  };
  const people = {
    byIds: jest.fn(async (ids: string[]) => new Map(ids.map((id) => [id, person(id)]))),
  };
  const records = { openFor: jest.fn().mockResolvedValue(new Map()) };
  const service = new ReviewsService(
    {} as never,
    submissions as never,
    records as never,
    people as never,
    catalog as never,
    mentees as never,
    {} as never,
    { now: () => now } as never,
    { REVIEW_TARGET_HOURS: 72 } as never,
  );
  return { service, submissions, mentees };
}

describe('ReviewsService.queue', () => {
  it('passes the filter on and reports stats for it', async () => {
    const { service, submissions } = setup({
      rows: [row('s1', 'an', 100), row('s2', 'binh', 5)],
      counts: { waiting: 2, claimed: 1, overTarget: 1 },
    });

    const queue = await service.queue(viewer, { track: 'sql-30-days' });

    expect(submissions.awaitingReview).toHaveBeenCalledWith({ track: 'sql-30-days' });
    // overdue = submitted more than REVIEW_TARGET_HOURS (72 h) before now
    expect(submissions.awaitingReviewCounts).toHaveBeenCalledWith(
      { track: 'sql-30-days' },
      hoursAgo(72),
    );
    expect(queue.filters).toEqual({ track: 'sql-30-days', mentee: null });
    expect(queue.stats).toEqual({
      waiting: 2,
      claimed: 1,
      overTarget: 1,
      oldestHoursWaiting: 100,
      inactiveMentees: null,
    });
    expect(queue.options).toEqual({
      tracks: [{ slug: 'sql-30-days', title: 'SQL 30 ngày' }],
      mentees: [],
    });
    expect(queue.items.map((i) => [i.submissionId, i.overTarget])).toEqual([
      ['s1', true],
      ['s2', false],
    ]);
  });

  it('has no oldest wait when nothing is waiting', async () => {
    const { service } = setup({ rows: [], counts: { waiting: 0, claimed: 0, overTarget: 0 } });
    const queue = await service.queue(viewer, {});
    expect(queue.stats.oldestHoursWaiting).toBeNull();
    expect(queue.filters).toEqual({ track: null, mentee: null });
  });

  it('shows the mentor’s mentees and the inactive count once E8 data exists', async () => {
    const { service, mentees } = setup({
      rows: [],
      counts: { waiting: 0, claimed: 0, overTarget: 0 },
      mentorship: { mentees: [person('an')], inactive: 1 },
    });
    const queue = await service.queue(viewer, { mentee: 'an' });
    expect(mentees.forMentor).toHaveBeenCalledWith('mentor-1', now);
    expect(queue.options.mentees).toEqual([person('an')]);
    expect(queue.stats.inactiveMentees).toBe(1);
    expect(queue.filters.mentee).toBe('an');
  });
});

describe('MenteeActivity.forMentor', () => {
  it('returns nothing (and no inactive count) for a mentor without mentees', async () => {
    const prisma = { mentorAssignment: { findMany: jest.fn().mockResolvedValue([]) } };
    const reader = new MenteeActivity(
      prisma as never,
      { byIds: jest.fn() } as never,
      {} as never,
      {} as never,
    );
    expect(await reader.forMentor('mentor-1', now)).toEqual({ mentees: [], inactive: null });
    expect(prisma.mentorAssignment.findMany).toHaveBeenCalledWith({
      where: { mentorId: 'mentor-1', status: 'active' },
      select: { menteeId: true, startedAt: true },
    });
  });

  it('lists active mentees by name and counts those quiet for 14 days', async () => {
    const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
    const prisma = {
      mentorAssignment: {
        findMany: jest.fn().mockResolvedValue([
          { menteeId: 'binh', startedAt: daysAgo(60) },
          { menteeId: 'an', startedAt: daysAgo(60) },
        ]),
      },
    };
    const people = {
      byIds: jest.fn(async (ids: string[]) => new Map(ids.map((id) => [id, person(id)]))),
    };
    // Activity comes from the owning modules: submissions and learning.
    const submissions = {
      lastSubmittedFor: jest.fn().mockResolvedValue([{ userId: 'an', at: daysAgo(20) }]),
    };
    const lessons = {
      lastActivityFor: jest.fn().mockResolvedValue([{ userId: 'binh', at: daysAgo(1) }]),
    };
    const reader = new MenteeActivity(
      prisma as never,
      people as never,
      submissions as never,
      lessons as never,
    );

    const result = await reader.forMentor('mentor-1', now);

    expect(result.mentees.map((m) => m.id)).toEqual(['an', 'binh']);
    expect(result.inactive).toBe(1);
    expect(submissions.lastSubmittedFor).toHaveBeenCalledWith(['binh', 'an']);
  });
});
