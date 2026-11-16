import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { normalizeEmail } from './approval';
import { UserEvents } from './users.events';

export type ListUpdateMode = 'replace' | 'append';

export interface ListUpdateResult {
  /** emails on the list after the update */
  total: number;
  /** pending accounts that became active because their email is now on the list */
  activated: number;
}

/**
 * The club's list of member emails (decided 16/11/2026). Personal data:
 * admin-only, changes are audit-logged by count (never the addresses themselves).
 */
@Injectable()
export class ApprovedEmailsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async list() {
    const rows = await this.prisma.approvedEmail.findMany({
      orderBy: { email: 'asc' },
      select: { email: true, note: true, createdAt: true },
    });
    return { total: rows.length, emails: rows };
  }

  /**
   * `replace` = the pasted list becomes the whole list; `append` = add to it.
   * Pending accounts whose email is on the new list are activated in the same transaction.
   * Removing an email never locks an account that is already active.
   */
  async update(
    actorId: string,
    rawEmails: string[],
    mode: ListUpdateMode,
    note?: string,
  ): Promise<ListUpdateResult> {
    const emails = [...new Set(rawEmails.map(normalizeEmail))];

    const { total, activatedIds } = await this.prisma.$transaction(async (tx) => {
      if (mode === 'replace') await tx.approvedEmail.deleteMany({});
      await tx.approvedEmail.createMany({
        data: emails.map((email) => ({ email, note, addedBy: actorId })),
        skipDuplicates: true,
      });

      const waiting = await tx.user.findMany({
        where: { status: 'pending', deletedAt: null, email: { in: emails } },
        select: { id: true },
      });
      const ids = waiting.map((u) => u.id);
      if (ids.length) {
        await tx.user.updateMany({ where: { id: { in: ids } }, data: { status: 'active' } });
      }
      return { total: await tx.approvedEmail.count(), activatedIds: ids };
    });

    await this.events.emitAsync(UserEvents.ApprovedEmailsChanged, {
      actorId,
      mode,
      submitted: emails.length,
      total,
      activated: activatedIds.length,
    });
    for (const userId of activatedIds) {
      await this.events.emitAsync(UserEvents.Approved, {
        actorId,
        userId,
        reason: 'approved_email',
      });
    }
    return { total, activated: activatedIds.length };
  }
}
