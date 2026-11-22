import { awaitingReviewWhere, SubmissionReviewService } from './submission-review.service';

describe('awaitingReviewWhere', () => {
  it('without a filter: every submission waiting for review', () => {
    expect(awaitingReviewWhere({})).toEqual({ status: 'awaiting_review' });
  });

  it('filters by track slug through exercise → module → track', () => {
    expect(awaitingReviewWhere({ track: 'sql-30-days' })).toEqual({
      status: 'awaiting_review',
      exercise: { module: { track: { slug: 'sql-30-days' } } },
    });
  });

  it('filters by the member’s GitHub login, ignoring case', () => {
    expect(awaitingReviewWhere({ mentee: 'TienNHM' })).toEqual({
      status: 'awaiting_review',
      user: { githubLogin: { equals: 'TienNHM', mode: 'insensitive' } },
    });
  });

  it('combines both filters', () => {
    const where = awaitingReviewWhere({ track: 'python', mentee: 'an' });
    expect(where).toMatchObject({
      status: 'awaiting_review',
      exercise: { module: { track: { slug: 'python' } } },
      user: { githubLogin: { equals: 'an' } },
    });
  });
});

describe('SubmissionReviewService.awaitingReviewCounts', () => {
  function setup(counts: number[]) {
    const count = jest.fn();
    for (const c of counts) count.mockResolvedValueOnce(c);
    const prisma = { submission: { count } };
    const service = new SubmissionReviewService(prisma as never, {} as never, {} as never);
    return { service, count };
  }

  it('counts waiting, claimed and overdue submissions for the same filter', async () => {
    const { service, count } = setup([7, 2, 3]);
    const overdueBefore = new Date('2026-11-15T12:00:00Z');

    const result = await service.awaitingReviewCounts({ track: 'python' }, overdueBefore);

    expect(result).toEqual({ waiting: 7, claimed: 2, overTarget: 3 });
    const base = awaitingReviewWhere({ track: 'python' });
    expect(count).toHaveBeenNthCalledWith(1, { where: base });
    expect(count).toHaveBeenNthCalledWith(2, {
      where: { ...base, reviews: { some: { status: 'in_progress' } } },
    });
    expect(count).toHaveBeenNthCalledWith(3, {
      where: { ...base, submittedAt: { lt: overdueBefore } },
    });
  });

  it('passes the filter to the queue query as well', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new SubmissionReviewService(
      { submission: { findMany } } as never,
      {} as never,
      {} as never,
    );
    await service.awaitingReview({ mentee: 'an' });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: awaitingReviewWhere({ mentee: 'an' }),
        orderBy: { submittedAt: 'asc' },
      }),
    );
  });
});

describe('SubmissionReviewService.unclaimedCount', () => {
  it('counts waiting submissions with no review in progress, across every track', async () => {
    const count = jest.fn().mockResolvedValue(4);
    const service = new SubmissionReviewService(
      { submission: { count } } as never,
      {} as never,
      {} as never,
    );
    await expect(service.unclaimedCount()).resolves.toBe(4);
    expect(count).toHaveBeenCalledWith({
      where: { ...awaitingReviewWhere({}), reviews: { none: { status: 'in_progress' } } },
    });
  });
});
