import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { Role } from '@hub/shared';
import type { AuthUser } from '../../common/auth.decorators';
import { DomainError } from '../../common/errors';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { SubmissionReviewService } from '../submissions/submission-review.service';
import type { PeopleReader } from '../users/people.reader';
import type { UsersService } from '../users/users.service';
import type { ReviewRecords } from './review-records';
import { ReviewThreadService } from './review-thread.service';
import { ReviewEvents } from './reviews.events';

const as = (id: string, ...roles: Role[]) => ({ id, roles: ['member', ...roles] }) as AuthUser;

function setup(status = 'changes_requested') {
  const comments: { id: string; authorId: string; bodyMd: string; createdAt: Date }[] = [];
  const prisma = {
    reviewComment: {
      findMany: jest.fn(async () => comments),
      count: jest.fn(async () => comments.length),
      create: jest.fn(
        async ({ data }: { data: { id: string; authorId: string; bodyMd: string } }) => {
          const row = { ...data, createdAt: new Date('2026-11-23T08:00:00Z') };
          comments.push(row);
          return row;
        },
      ),
    },
    reviewThanks: {
      findUnique: jest.fn(async () => null),
      count: jest.fn(async () => 0),
      create: jest.fn(async ({ data }: { data: { body: string } }) => ({
        body: data.body,
        isPublic: false,
        createdAt: new Date('2026-11-23T09:00:00Z'),
      })),
    },
  };
  const records = {
    findById: jest.fn(async (id: string) =>
      id === 'r1' ? { id: 'r1', submissionId: 's1', reviewerId: 'mentor', status } : null,
    ),
  };
  const submissions = { owner: jest.fn(async () => ({ userId: 'member', exerciseId: 'ex-1' })) };
  const people = {
    byIds: jest.fn(
      async (ids: string[]) =>
        new Map(ids.map((id) => [id, { id, githubLogin: id, displayName: id, avatarUrl: null }])),
    ),
  };
  const events = { emitAsync: jest.fn(async () => []) };
  const service = new ReviewThreadService(
    prisma as unknown as PrismaService,
    records as unknown as ReviewRecords,
    submissions as unknown as SubmissionReviewService,
    people as unknown as PeopleReader,
    {} as UsersService,
    events as unknown as EventEmitter2,
  );
  return { service, prisma, events };
}

async function statusOf(promise: Promise<unknown>): Promise<number | undefined> {
  try {
    await promise;
    return undefined;
  } catch (err) {
    if (err instanceof DomainError) return err.status;
    throw err;
  }
}

describe('ReviewThreadService (learning-hub#41)', () => {
  it('keeps the conversation from other mentors, and 404s an unknown review', async () => {
    const { service, prisma } = setup();
    expect(await statusOf(service.thread(as('other', 'mentor'), 'r1'))).toBe(403);
    expect(await statusOf(service.post(as('other', 'mentor'), 'r1', 'hi'))).toBe(403);
    expect(prisma.reviewComment.create).not.toHaveBeenCalled();
    expect(await statusOf(service.thread(as('member'), 'nope'))).toBe(404);
  });

  it('saves a member reply, tells the bell, and shows it with the right roles', async () => {
    const { service, events } = setup();
    const reply = await service.post(as('member'), 'r1', 'Em chưa hiểu ý 2 ạ');
    expect(reply.role).toBe('mentee');
    expect(events.emitAsync).toHaveBeenCalledWith(ReviewEvents.MessagePosted, {
      reviewId: 'r1',
      submissionId: 's1',
      exerciseId: 'ex-1',
      memberId: 'member',
      reviewerId: 'mentor',
      authorId: 'member',
    });
    await service.post(as('mentor', 'mentor'), 'r1', 'Ý 2 là…');

    const thread = await service.thread(as('mentor', 'mentor'), 'r1');
    expect(thread.viewerRole).toBe('mentor');
    expect(thread.messages.map((m) => m.role)).toEqual(['mentee', 'mentor']);
    expect(thread.canPost).toBe(true);
    expect(thread.canThank).toBe(false);
    expect((await service.thread(as('member'), 'r1')).canThank).toBe(true);
  });

  it('opens nothing while the review is still a draft', async () => {
    const { service, prisma } = setup('in_progress');
    expect(await statusOf(service.post(as('member'), 'r1', 'hi'))).toBe(409);
    expect(await statusOf(service.thank(as('member'), 'r1', 'cảm ơn'))).toBe(409);
    expect(prisma.reviewComment.create).not.toHaveBeenCalled();
    expect((await service.thread(as('member'), 'r1')).canPost).toBe(false);
  });

  it('lets only the member thank the mentor, and tells the bell', async () => {
    const { service, events } = setup('approved');
    expect(await statusOf(service.thank(as('mentor', 'mentor'), 'r1', 'tự cảm ơn'))).toBe(403);
    const thanks = await service.thank(as('member'), 'r1', 'Cảm ơn anh nhiều!');
    expect(thanks).toMatchObject({ body: 'Cảm ơn anh nhiều!', isPublic: false });
    expect(events.emitAsync).toHaveBeenCalledWith(
      ReviewEvents.ThanksSent,
      expect.objectContaining({ reviewerId: 'mentor', authorId: 'member' }),
    );
  });
});
