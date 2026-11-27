import type { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { ContentPublishedEvent } from '../../content/content.events';
import { OutboxTypes } from '../outbox/outbox';
import { InboxListener } from './inbox.listener';

function setup() {
  const outboxEvent = { create: jest.fn(async (_args: unknown) => ({})) };
  const listener = new InboxListener({ outboxEvent } as unknown as PrismaService);
  const queued = () =>
    outboxEvent.create.mock.calls.map((c) => (c[0] as { data: { type: string } }).data);
  return { listener, outboxEvent, queued };
}

describe('InboxListener', () => {
  it('queues a review result with ids only', async () => {
    const { listener, queued } = setup();
    await listener.onReviewCompleted({
      reviewId: 'r1',
      submissionId: 's1',
      exerciseId: 'ex-1',
      memberId: 'm1',
      reviewerId: 'mentor-1',
      outcome: 'changes_requested',
    });
    expect(queued()).toEqual([
      {
        type: OutboxTypes.ReviewCompleted,
        payload: { exerciseId: 'ex-1', memberId: 'm1', outcome: 'changes_requested' },
      },
    ]);
  });

  it('queues a bell row for the reporter only when a content report closes (#121)', async () => {
    const { listener, queued } = setup();
    const base = {
      actorId: 'mentor-1',
      reportId: 'cr-1',
      reporterId: 'an',
      trackSlug: 'sql',
      targetTitle: 'SELECT cơ bản',
      targetLink: '/lessons/l-1',
    };
    await listener.onContentReportStatusChanged({
      ...base,
      from: 'open',
      to: 'in_progress',
      notifyReporter: false,
    });
    await listener.onContentReportStatusChanged({
      ...base,
      from: 'open',
      to: 'resolved',
      notifyReporter: true,
    });
    expect(queued()).toEqual([
      {
        type: OutboxTypes.ContentReportClosed,
        payload: {
          reporterId: 'an',
          status: 'resolved',
          targetTitle: 'SELECT cơ bản',
          targetLink: '/lessons/l-1',
        },
      },
    ]);
  });

  it('queues one row for a mentor change, with names for the bell text (#131)', async () => {
    const { listener, queued } = setup();
    await listener.onMenteeMentorChanged({
      actorId: 'admin',
      assignmentId: 'ma-1',
      menteeId: 'an',
      menteeLogin: 'an-dev',
      menteeName: 'Nguyễn An',
      trackSlug: 'sql',
      trackTitle: 'SQL',
      mentorId: null,
      mentorLogin: null,
      mentorName: null,
      previousMentorId: 'binh',
      previousMentorLogin: 'binh',
      previousMentorName: 'Trần Bình',
    });
    expect(queued()).toEqual([
      {
        type: OutboxTypes.MentorAssignment,
        payload: {
          actorId: 'admin',
          trackSlug: 'sql',
          trackTitle: 'SQL',
          mentee: { id: 'an', login: 'an-dev', name: 'Nguyễn An' },
          mentor: null,
          previousMentor: { id: 'binh', login: 'binh', name: 'Trần Bình' },
        },
      },
    ]);
  });

  it('queues a review request for mentors', async () => {
    const { listener, queued } = setup();
    await listener.onAwaitingReview({
      submissionId: 's1',
      userId: 'm1',
      exerciseId: 'ex-1',
      status: 'awaiting_review',
    });
    expect(queued()[0]).toEqual({
      type: OutboxTypes.ReviewRequested,
      payload: { submissionId: 's1', exerciseId: 'ex-1', memberId: 'm1' },
    });
  });

  it('queues only whole new tracks from a publish', async () => {
    const { listener, queued } = setup();
    const event = {
      changes: {
        removed: 0,
        tracks: [
          { slug: 'sql', title: 'SQL', isNew: false, added: ['x'], changed: [] },
          { slug: 'git', title: 'Git', isNew: true, added: [], changed: [] },
        ],
      },
    } as unknown as ContentPublishedEvent;
    await listener.onContentPublished(event);
    expect(queued()).toEqual([
      { type: OutboxTypes.TrackPublished, payload: { slug: 'git', title: 'Git' } },
    ]);
  });

  it('never breaks the member’s action when the insert fails', async () => {
    const { listener, outboxEvent } = setup();
    outboxEvent.create.mockRejectedValueOnce(new Error('db down'));
    await expect(
      listener.onAwaitingReview({ submissionId: 's', userId: 'u', exerciseId: 'e', status: 'x' }),
    ).resolves.toBeUndefined();
  });
});
