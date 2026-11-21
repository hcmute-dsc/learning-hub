import { DomainError } from '../../../common/errors';
import type { CatalogReader } from '../../catalog/catalog.reader';
import type { UsersService } from '../../users/users.service';
import type { DigestService } from '../digest/digest.service';
import type { InboxNotice } from '../inbox/inbox-messages';
import type { InboxService } from '../inbox/inbox.service';
import type { WeeklyLeaderboardService } from '../weekly-leaderboard/weekly-leaderboard.service';
import { NotificationDispatcher } from './notification-dispatcher';
import { OutboxTypes } from './outbox';

function setup() {
  const catalog = {
    exercise: jest.fn(async (_id: string) => ({
      title: 'Todo API',
      track: { title: 'Backend' },
    })),
  };
  const users = {
    activeIds: jest.fn(async (roles?: string[]) => (roles ? ['mentor-1', 'm1'] : ['a', 'b', 'c'])),
  };
  const delivered: { eventId: bigint; userIds: string[]; notice: InboxNotice }[] = [];
  const inbox = {
    deliver: jest.fn(async (eventId: bigint, userIds: string[], notice: InboxNotice) => {
      delivered.push({ eventId, userIds, notice });
      return userIds.length;
    }),
  };
  const digest = { send: jest.fn(async () => 'sent') };
  const poster = {
    enabled: true,
    post: jest.fn(async (_message: unknown) => ({
      messageId: '999999999999999999' as string | null,
    })),
    edit: jest.fn(async () => {}),
  };
  const weekly = { recordPosted: jest.fn(async () => {}) };
  const dispatcher = new NotificationDispatcher(
    catalog as unknown as CatalogReader,
    users as unknown as UsersService,
    inbox as unknown as InboxService,
    digest as unknown as DigestService,
    poster,
    weekly as unknown as WeeklyLeaderboardService,
  );
  return { dispatcher, catalog, users, delivered, digest, poster, weekly };
}

describe('NotificationDispatcher', () => {
  it('notifies only the reviewed member', async () => {
    const { dispatcher, delivered } = setup();
    await dispatcher.dispatch(1n, OutboxTypes.ReviewCompleted, {
      exerciseId: 'ex-1',
      memberId: 'm1',
      outcome: 'approved',
    });
    expect(delivered).toHaveLength(1);
    expect(delivered[0].userIds).toEqual(['m1']);
    expect(delivered[0].eventId).toBe(1n);
    expect(delivered[0].notice.payload.title).toContain('Todo API');
  });

  it('notifies mentors and admins about a new review request, never the member who submitted', async () => {
    const { dispatcher, delivered, users } = setup();
    await dispatcher.dispatch(2n, OutboxTypes.ReviewRequested, {
      submissionId: 's1',
      exerciseId: 'ex-1',
      memberId: 'm1',
    });
    expect(users.activeIds).toHaveBeenCalledWith(['mentor', 'admin']);
    expect(delivered[0].userIds).toEqual(['mentor-1']);
    expect(delivered[0].notice.payload.link).toBe('/review/s1');
  });

  it('notifies every active member about a new track', async () => {
    const { dispatcher, delivered, users } = setup();
    await dispatcher.dispatch(3n, OutboxTypes.TrackPublished, { slug: 'git', title: 'Git' });
    expect(users.activeIds).toHaveBeenCalledWith();
    expect(delivered[0].userIds).toEqual(['a', 'b', 'c']);
    expect(delivered[0].notice.type).toBe('track_published');
  });

  it('sends a queued email digest', async () => {
    const { dispatcher, digest } = setup();
    const payload = { userId: 'u1', since: '2026-11-17T00:00:00Z' };
    await dispatcher.dispatch(4n, OutboxTypes.EmailDigest, payload);
    expect(digest.send).toHaveBeenCalledWith(payload);
  });

  it('drops an event whose exercise no longer exists instead of retrying forever', async () => {
    const { dispatcher, catalog, delivered } = setup();
    catalog.exercise.mockRejectedValueOnce(DomainError.notFound('Exercise'));
    await expect(
      dispatcher.dispatch(5n, OutboxTypes.ReviewCompleted, {
        exerciseId: 'gone',
        memberId: 'm1',
        outcome: 'approved',
      }),
    ).resolves.toBeUndefined();
    expect(delivered).toHaveLength(0);
  });

  it('throws on other errors and unknown types, so the worker retries or fails the row', async () => {
    const { dispatcher, catalog } = setup();
    catalog.exercise.mockRejectedValueOnce(new Error('db down'));
    await expect(
      dispatcher.dispatch(6n, OutboxTypes.ReviewCompleted, {
        exerciseId: 'x',
        memberId: 'm1',
        outcome: 'approved',
      }),
    ).rejects.toThrow('db down');
    await expect(dispatcher.dispatch(7n, 'something.else', {})).rejects.toThrow('Unknown');
  });

  it('posts the weekly leaderboard as queued, and throws when Discord refuses (retry)', async () => {
    const { dispatcher, poster, weekly } = setup();
    const payload = {
      weekId: '2026-W47',
      content: 'hi <@123456789012345678>',
      embeds: [{ title: 't' }],
      mentionUserIds: ['123456789012345678'],
    };
    await dispatcher.dispatch(8n, OutboxTypes.LeaderboardWeek, payload);
    expect(poster.post).toHaveBeenCalledWith({
      content: payload.content,
      embeds: payload.embeds,
      mentionUserIds: payload.mentionUserIds,
    });
    // the message id is kept for the admin's "Cập nhật" (learning-hub#83)
    expect(weekly.recordPosted).toHaveBeenCalledWith('2026-W47', '999999999999999999');

    poster.post.mockRejectedValueOnce(new Error('Discord webhook refused: HTTP 500'));
    await expect(dispatcher.dispatch(9n, OutboxTypes.LeaderboardWeek, payload)).rejects.toThrow(
      'HTTP 500',
    );
  });
});
