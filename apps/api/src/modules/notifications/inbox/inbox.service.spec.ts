import { DomainError } from '../../../common/errors';
import type { Clock } from '../../../infrastructure/clock';
import type { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { trackPublishedNotice } from './inbox-messages';
import { InboxService, RETENTION_DAYS } from './inbox.service';

const NOW = new Date('2026-11-18T10:00:00Z');

function setup() {
  const notification = {
    findMany: jest.fn(async (_args: unknown): Promise<unknown[]> => []),
    count: jest.fn(async (_args: unknown) => 0),
    updateMany: jest.fn(async (_args: unknown) => ({ count: 0 })),
    createMany: jest.fn(async (args: { data: unknown[] }) => ({ count: args.data.length })),
    deleteMany: jest.fn(async (_args: unknown) => ({ count: 0 })),
  };
  const prisma = { notification } as unknown as PrismaService;
  const clock = { now: () => NOW } as Clock;
  return { inbox: new InboxService(prisma, clock), notification };
}

describe('InboxService', () => {
  it('lists only the signed-in member’s notifications, with the unread count', async () => {
    const { inbox, notification } = setup();
    notification.findMany.mockResolvedValueOnce([
      {
        id: 'n1',
        type: 'track_published',
        payload: { title: 'Lộ trình mới: Git', body: null, link: '/tracks/git' },
        readAt: null,
        createdAt: NOW,
      },
    ]);
    notification.count.mockResolvedValueOnce(3);
    const list = await inbox.list('u1');
    expect(notification.findMany.mock.calls[0][0]).toMatchObject({ where: { userId: 'u1' } });
    expect(notification.count.mock.calls[0][0]).toEqual({ where: { userId: 'u1', readAt: null } });
    expect(list).toEqual({
      unreadCount: 3,
      data: [
        {
          id: 'n1',
          type: 'track_published',
          title: 'Lộ trình mới: Git',
          body: null,
          link: '/tracks/git',
          read: false,
          createdAt: NOW.toISOString(),
        },
      ],
    });
  });

  describe('markRead', () => {
    it('marks the member’s own unread notification', async () => {
      const { inbox, notification } = setup();
      notification.updateMany.mockResolvedValueOnce({ count: 1 });
      await inbox.markRead('u1', 'n1');
      expect(notification.updateMany).toHaveBeenCalledWith({
        where: { id: 'n1', userId: 'u1', readAt: null },
        data: { readAt: NOW },
      });
    });

    it('is a no-op for one already read', async () => {
      const { inbox, notification } = setup();
      notification.count.mockResolvedValueOnce(1);
      await expect(inbox.markRead('u1', 'n1')).resolves.toBeUndefined();
    });

    it('answers 404 for someone else’s notification', async () => {
      const { inbox, notification } = setup();
      notification.count.mockResolvedValueOnce(0);
      const err = await inbox.markRead('u2', 'n1').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe('NOT_FOUND');
      expect(notification.count).toHaveBeenCalledWith({ where: { id: 'n1', userId: 'u2' } });
    });
  });

  it('marks all of one member’s notifications read', async () => {
    const { inbox, notification } = setup();
    await inbox.markAllRead('u1');
    expect(notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', readAt: null },
      data: { readAt: NOW },
    });
  });

  describe('deliver', () => {
    it('writes one row per recipient, tied to the outbox event, skipping duplicates', async () => {
      const { inbox, notification } = setup();
      const notice = trackPublishedNotice({ slug: 'git', title: 'Git' });
      const count = await inbox.deliver(7n, ['u1', 'u2', 'u1'], notice);
      expect(count).toBe(2);
      const args = notification.createMany.mock.calls[0][0] as unknown as {
        data: { userId: string; sourceEventId: bigint; type: string }[];
        skipDuplicates: boolean;
      };
      expect(args.skipDuplicates).toBe(true);
      expect(args.data.map((d) => d.userId)).toEqual(['u1', 'u2']);
      expect(args.data.every((d) => d.sourceEventId === 7n && d.type === 'track_published')).toBe(
        true,
      );
    });

    it('writes nothing without recipients', async () => {
      const { inbox, notification } = setup();
      await inbox.deliver(1n, [], trackPublishedNotice({ slug: 'g', title: 'G' }));
      expect(notification.createMany).not.toHaveBeenCalled();
    });
  });

  it(`deletes notifications older than ${RETENTION_DAYS} days`, async () => {
    const { inbox, notification } = setup();
    await inbox.pruneOld();
    const cutoff = new Date(NOW.getTime() - RETENTION_DAYS * 86_400_000);
    expect(notification.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: cutoff } },
    });
  });
});
