import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { NotificationSettings } from '@hub/shared';
import { DomainError } from '../../../common/errors';
import { Clock } from '../../../infrastructure/clock';
import { ENV, type Env } from '../../../infrastructure/config/env';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { InboxService } from '../inbox/inbox.service';
import { OutboxTypes, type EmailDigestPayload } from '../outbox/outbox';
import { MAIL_SENDER, type MailSender } from '../ports/mail-sender';
import { buildDigestEmail, DIGEST_MAX_ITEMS, digestWindowStart, isDigestDue } from './digest-rules';

/** 256 random bits, URL-safe (43 characters). */
export const newUnsubscribeToken = (): string => randomBytes(32).toString('base64url');

/**
 * The optional daily email digest (learning-hub#49, PRD F13). Off by default; on only
 * when the member turns it on in /settings AND the server has SMTP settings. Without
 * SMTP nothing is scheduled and nothing is sent.
 */
@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly users: UsersService,
    private readonly inbox: InboxService,
    @Inject(MAIL_SENDER) private readonly mail: MailSender,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async settings(userId: string): Promise<NotificationSettings> {
    const [pref, contact] = await Promise.all([
      this.prisma.notificationPreference.findUnique({ where: { userId } }),
      this.users.digestContact(userId),
    ]);
    return {
      emailDigest: pref?.emailDigest ?? false,
      emailAvailable: this.mail.enabled,
      hasEmail: contact !== null,
    };
  }

  async updateSettings(userId: string, emailDigest: boolean): Promise<NotificationSettings> {
    if (emailDigest) {
      if (!this.mail.enabled) {
        throw DomainError.conflict('Máy chủ chưa cấu hình gửi email, chưa bật được email tóm tắt.');
      }
      if (!(await this.users.digestContact(userId))) {
        throw DomainError.conflict('Tài khoản GitHub của bạn chưa có email để nhận tóm tắt.');
      }
    }
    // Turning it on (from off) starts the window now: the first digest comes at the next
    // 08:00 and only lists what arrived after the member opted in. Saving "on" again while
    // already on must not push the next digest back.
    const current = await this.prisma.notificationPreference.findUnique({ where: { userId } });
    const turningOn = emailDigest && !current?.emailDigest;
    const lastDigestAt = turningOn ? this.clock.now() : undefined;
    await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, emailDigest, unsubscribeToken: newUnsubscribeToken(), lastDigestAt },
      update: { emailDigest, ...(lastDigestAt ? { lastDigestAt } : {}) },
    });
    return this.settings(userId);
  }

  /**
   * The link in the email works without signing in: the token is the credential.
   * Same answer for an unknown token, so tokens cannot be probed.
   */
  async unsubscribe(token: string): Promise<void> {
    await this.prisma.notificationPreference.updateMany({
      where: { unsubscribeToken: token },
      data: { emailDigest: false },
    });
  }

  /**
   * Queue one digest per member whose digest is due. Setting last_digest_at in the same
   * transaction (only if it did not change meanwhile) means a member is queued once a day.
   */
  async scheduleDue(): Promise<number> {
    if (!this.mail.enabled) return 0;
    const now = this.clock.now();
    const windowStart = digestWindowStart(now);
    const due = await this.prisma.notificationPreference.findMany({
      where: {
        emailDigest: true,
        OR: [{ lastDigestAt: null }, { lastDigestAt: { lt: windowStart } }],
      },
      select: { userId: true, lastDigestAt: true },
      take: 500,
    });
    let queued = 0;
    for (const pref of due) {
      if (!isDigestDue(now, pref.lastDigestAt)) continue;
      const since = pref.lastDigestAt ?? new Date(now.getTime() - 24 * 60 * 60_000);
      const payload: EmailDigestPayload = { userId: pref.userId, since: since.toISOString() };
      const claimed = await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.notificationPreference.updateMany({
          where: { userId: pref.userId, lastDigestAt: pref.lastDigestAt },
          data: { lastDigestAt: now },
        });
        if (count === 0) return false;
        await tx.outboxEvent.create({
          data: { type: OutboxTypes.EmailDigest, payload: payload as unknown as object },
        });
        return true;
      });
      if (claimed) queued++;
    }
    return queued;
  }

  /** Send one queued digest. Throws on SMTP errors so the outbox retries. */
  async send(payload: EmailDigestPayload): Promise<'sent' | 'skipped'> {
    if (!this.mail.enabled) return 'skipped';
    const pref = await this.prisma.notificationPreference.findUnique({
      where: { userId: payload.userId },
    });
    if (!pref?.emailDigest) return 'skipped'; // turned off after it was queued
    const contact = await this.users.digestContact(payload.userId);
    if (!contact) return 'skipped';

    const items = await this.inbox.unreadSince(
      payload.userId,
      new Date(payload.since),
      DIGEST_MAX_ITEMS + 50,
    );
    const unsubscribeUrl = `${this.env.WEB_ORIGIN.replace(/\/+$/, '')}/unsubscribe?token=${pref.unsubscribeToken}`;
    const email = buildDigestEmail({
      displayName: contact.displayName,
      items,
      webOrigin: this.env.WEB_ORIGIN,
      unsubscribeUrl,
    });
    if (!email) return 'skipped'; // nothing new: no empty emails
    await this.mail.send({ to: contact.email, unsubscribeUrl, ...email });
    this.logger.log({ userId: payload.userId, items: items.length }, 'Email digest sent');
    return 'sent';
  }
}
