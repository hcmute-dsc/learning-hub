import { DomainError } from '../../../common/errors';
import type { Clock } from '../../../infrastructure/clock';
import type { Env } from '../../../infrastructure/config/env';
import type { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { UsersService } from '../../users/users.service';
import type { InboxService } from '../inbox/inbox.service';
import { OutboxTypes } from '../outbox/outbox';
import type { MailMessage, MailSender } from '../ports/mail-sender';
import { DigestService, newUnsubscribeToken } from './digest.service';

// 09:00 in Vietnam
const NOW = new Date('2026-11-18T02:00:00Z');
const TOKEN = 'a'.repeat(43);

interface Pref {
  userId: string;
  emailDigest: boolean;
  unsubscribeToken: string;
  lastDigestAt: Date | null;
}

function setup(opts: { smtp?: boolean; email?: string | null; pref?: Pref | null } = {}) {
  const pref = opts.pref === undefined ? null : opts.pref;
  const notificationPreference = {
    findUnique: jest.fn(async (_args: unknown) => pref),
    findMany: jest.fn(async (_args: unknown) => (pref ? [pref] : [])),
    upsert: jest.fn(async (_args: unknown) => pref),
    updateMany: jest.fn(async (_args: unknown) => ({ count: 1 })),
  };
  const outboxEvent = { create: jest.fn(async (_args: unknown) => ({})) };
  const tx = { notificationPreference, outboxEvent };
  const prisma = {
    notificationPreference,
    outboxEvent,
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  } as unknown as PrismaService;
  const email = opts.email === undefined ? 'an@example.org' : opts.email;
  const users = {
    digestContact: jest.fn(async () => (email ? { email, displayName: 'An' } : null)),
  } as unknown as UsersService;
  const inbox = {
    unreadSince: jest.fn(async () => [{ title: 'Bài "Todo" đã đạt', body: null, link: '/x' }]),
  };
  const sent: MailMessage[] = [];
  const mail: MailSender = {
    enabled: opts.smtp ?? true,
    send: jest.fn(async (m: MailMessage) => {
      sent.push(m);
    }),
  };
  const env = { WEB_ORIGIN: 'https://learn.example.org' } as Env;
  const service = new DigestService(
    prisma,
    { now: () => NOW } as Clock,
    users,
    inbox as unknown as InboxService,
    mail,
    env,
  );
  return { service, notificationPreference, outboxEvent, inbox, sent, mail };
}

const onPref = (lastDigestAt: Date | null): Pref => ({
  userId: 'u1',
  emailDigest: true,
  unsubscribeToken: TOKEN,
  lastDigestAt,
});

describe('DigestService settings', () => {
  it('is off by default and says whether email can be used', async () => {
    const { service } = setup({ smtp: false });
    expect(await service.settings('u1')).toEqual({
      emailDigest: false,
      emailAvailable: false,
      hasEmail: true,
    });
  });

  it('cannot be turned on without SMTP', async () => {
    const { service, notificationPreference } = setup({ smtp: false });
    const err = await service.updateSettings('u1', true).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect(notificationPreference.upsert).not.toHaveBeenCalled();
  });

  it('cannot be turned on for an account without an email', async () => {
    const { service } = setup({ email: null });
    await expect(service.updateSettings('u1', true)).rejects.toBeInstanceOf(DomainError);
  });

  it('turning on starts the digest window now and creates an unsubscribe token', async () => {
    const { service, notificationPreference } = setup();
    await service.updateSettings('u1', true);
    const args = notificationPreference.upsert.mock.calls[0][0] as {
      where: { userId: string };
      create: { emailDigest: boolean; unsubscribeToken: string; lastDigestAt: Date };
      update: { emailDigest: boolean; lastDigestAt: Date };
    };
    expect(args.where).toEqual({ userId: 'u1' });
    expect(args.create.emailDigest).toBe(true);
    expect(args.create.unsubscribeToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(args.update).toEqual({ emailDigest: true, lastDigestAt: NOW });
  });

  it('saving "on" again keeps the digest window', async () => {
    const yesterday = new Date('2026-11-17T02:00:00Z');
    const { service, notificationPreference } = setup({ pref: onPref(yesterday) });
    await service.updateSettings('u1', true);
    const args = notificationPreference.upsert.mock.calls[0][0] as { update: object };
    expect(args.update).toEqual({ emailDigest: true });
  });

  it('can always be turned off, even without SMTP', async () => {
    const { service, notificationPreference } = setup({ smtp: false });
    await service.updateSettings('u1', false);
    const args = notificationPreference.upsert.mock.calls[0][0] as { update: object };
    expect(args.update).toEqual({ emailDigest: false });
  });

  it('unsubscribes by token only', async () => {
    const { service, notificationPreference } = setup();
    await service.unsubscribe(TOKEN);
    expect(notificationPreference.updateMany).toHaveBeenCalledWith({
      where: { unsubscribeToken: TOKEN },
      data: { emailDigest: false },
    });
  });

  it('makes long random tokens', () => {
    expect(newUnsubscribeToken()).not.toBe(newUnsubscribeToken());
    expect(newUnsubscribeToken()).toHaveLength(43);
  });
});

describe('DigestService scheduling', () => {
  it('does nothing without SMTP', async () => {
    const { service, notificationPreference } = setup({ smtp: false, pref: onPref(null) });
    expect(await service.scheduleDue()).toBe(0);
    expect(notificationPreference.findMany).not.toHaveBeenCalled();
  });

  it('queues one digest for a member whose last digest was yesterday', async () => {
    const yesterday = new Date('2026-11-17T02:00:00Z');
    const { service, outboxEvent, notificationPreference } = setup({ pref: onPref(yesterday) });
    expect(await service.scheduleDue()).toBe(1);
    expect(notificationPreference.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', lastDigestAt: yesterday },
      data: { lastDigestAt: NOW },
    });
    expect(outboxEvent.create).toHaveBeenCalledWith({
      data: {
        type: OutboxTypes.EmailDigest,
        payload: { userId: 'u1', since: yesterday.toISOString() },
      },
    });
  });

  it('skips a member already sent today', async () => {
    const { service, outboxEvent } = setup({ pref: onPref(new Date('2026-11-18T01:30:00Z')) });
    expect(await service.scheduleDue()).toBe(0);
    expect(outboxEvent.create).not.toHaveBeenCalled();
  });

  it('does not queue twice when another pass got there first', async () => {
    const { service, outboxEvent, notificationPreference } = setup({ pref: onPref(null) });
    notificationPreference.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await service.scheduleDue()).toBe(0);
    expect(outboxEvent.create).not.toHaveBeenCalled();
  });
});

describe('DigestService send', () => {
  const payload = { userId: 'u1', since: '2026-11-17T02:00:00.000Z' };

  it('emails the unread notifications with an unsubscribe link', async () => {
    const { service, sent, inbox } = setup({ pref: onPref(null) });
    expect(await service.send(payload)).toBe('sent');
    expect(inbox.unreadSince).toHaveBeenCalledWith('u1', new Date(payload.since), 70);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('an@example.org');
    expect(sent[0].unsubscribeUrl).toBe(`https://learn.example.org/unsubscribe?token=${TOKEN}`);
    expect(sent[0].text).toContain(sent[0].unsubscribeUrl);
  });

  it('sends no empty email', async () => {
    const { service, sent, inbox } = setup({ pref: onPref(null) });
    inbox.unreadSince.mockResolvedValueOnce([]);
    expect(await service.send(payload)).toBe('skipped');
    expect(sent).toHaveLength(0);
  });

  it('skips a member who turned it off after it was queued', async () => {
    const { service, sent } = setup({ pref: { ...onPref(null), emailDigest: false } });
    expect(await service.send(payload)).toBe('skipped');
    expect(sent).toHaveLength(0);
  });

  it('skips a suspended or deleted account (no contact)', async () => {
    const { service, sent } = setup({ pref: onPref(null), email: null });
    expect(await service.send(payload)).toBe('skipped');
    expect(sent).toHaveLength(0);
  });

  it('lets an SMTP error through so the outbox retries', async () => {
    const { service, mail } = setup({ pref: onPref(null) });
    (mail.send as jest.Mock).mockRejectedValueOnce(new Error('421 try later'));
    await expect(service.send(payload)).rejects.toThrow('421');
  });
});
