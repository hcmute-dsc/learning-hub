import { Injectable } from '@nestjs/common';
import type { NotificationItem, NotificationList, NotificationType } from '@hub/shared';
import { DomainError } from '../../../common/errors';
import { Clock } from '../../../infrastructure/clock';
import { newId } from '../../../infrastructure/ids';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { readPayload, type InboxNotice, type InboxPayload } from './inbox-messages';

/** The bell shows the newest notifications only; older ones are still counted as unread. */
export const BELL_LIMIT = 20;
/** Notifications are deleted after this many days (DATABASE §9). */
export const RETENTION_DAYS = 90;

/**
 * The in-app bell (learning-hub#49). Every read and write is scoped to one user id taken
 * from the session, so a member can never see or mark someone else's notification.
 */
@Injectable()
export class InboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async list(userId: string): Promise<NotificationList> {
    const [rows, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: BELL_LIMIT,
      }),
      this.unreadCount(userId),
    ]);
    return { data: rows.map(toItem), unreadCount };
  }

  unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  /** 404 for an id that is not this member's, so ids of others cannot be probed. */
  async markRead(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: this.clock.now() },
    });
    if (count > 0) return;
    const exists = await this.prisma.notification.count({ where: { id, userId } });
    if (!exists) throw DomainError.notFound('Notification');
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: this.clock.now() },
    });
  }

  /**
   * One row per recipient. Called by the outbox worker; `sourceEventId` makes a retry
   * after a crash harmless (unique with user_id, duplicates are skipped).
   */
  async deliver(sourceEventId: bigint, userIds: string[], notice: InboxNotice): Promise<number> {
    const unique = [...new Set(userIds)];
    if (!unique.length) return 0;
    const { count } = await this.prisma.notification.createMany({
      data: unique.map((userId) => ({
        id: newId(),
        userId,
        type: notice.type,
        payload: notice.payload as unknown as object,
        sourceEventId,
      })),
      skipDuplicates: true,
    });
    return count;
  }

  /** Unread notifications newer than `since`, newest first (for the email digest). */
  async unreadSince(userId: string, since: Date, take: number): Promise<InboxPayload[]> {
    const rows = await this.prisma.notification.findMany({
      where: { userId, readAt: null, createdAt: { gt: since } },
      orderBy: { createdAt: 'desc' },
      take,
      select: { payload: true },
    });
    return rows.map((r) => readPayload(r.payload));
  }

  async pruneOld(): Promise<number> {
    const cutoff = new Date(this.clock.now().getTime() - RETENTION_DAYS * 24 * 60 * 60_000);
    const { count } = await this.prisma.notification.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return count;
  }
}

function toItem(row: {
  id: string;
  type: string;
  payload: unknown;
  readAt: Date | null;
  createdAt: Date;
}): NotificationItem {
  const payload = readPayload(row.payload);
  return {
    id: row.id,
    type: row.type as NotificationType,
    title: payload.title,
    body: payload.body,
    link: payload.link,
    read: row.readAt !== null,
    createdAt: row.createdAt.toISOString(),
  };
}
