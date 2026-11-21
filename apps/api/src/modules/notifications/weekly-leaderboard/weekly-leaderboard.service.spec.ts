import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { LeaderboardRow } from '@hub/shared';
import { DomainError } from '../../../common/errors';
import type { Clock } from '../../../infrastructure/clock';
import type { Env } from '../../../infrastructure/config/env';
import type { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { LeaderboardService } from '../../leaderboard/leaderboard.service';
import type { DiscordLinkService } from '../../users/discord-link.service';
import { OutboxTypes } from '../outbox/outbox';
import { ClubPostGoneError } from '../ports/notification-channel';
import { LeaderboardPostEvents } from './weekly-leaderboard.events';
import { WeeklyLeaderboardService } from './weekly-leaderboard.service';

const MONDAY_9 = new Date('2026-11-23T02:00:00Z');
const WEDNESDAY = new Date('2026-11-25T05:00:00Z');
const A = '111111111111111111';
const MSG = '999999999999999999';
const KEY = 'leaderboard-week:2026-W47';

const row = (id: string, rank: number, score: number): LeaderboardRow => ({
  rank,
  score,
  completed: score,
  user: { id, githubLogin: id, displayName: id, avatarUrl: null },
});

/**
 * A tiny in-memory outbox + leaderboard_week_posts, enough to check that the job and
 * the admin button share the week key: createMany skips a key that already exists.
 */
function setup(
  opts: {
    now?: Date;
    rows?: LeaderboardRow[];
    enabled?: boolean;
    links?: Map<string, string>;
    outbox?: { idempotencyKey: string; status: string }[];
    posted?: { weekId: string; discordMessageId: string }[];
  } = {},
) {
  const outbox = [...(opts.outbox ?? [])].map((r) => ({ ...r, createdAt: new Date() }));
  const posts = [...(opts.posted ?? [])].map((r) => ({
    ...r,
    postedAt: new Date('2026-11-23T02:01:00Z'),
    updatedAt: new Date('2026-11-23T02:01:00Z'),
  }));
  const outboxEvent = {
    findUnique: jest.fn(
      async (a: { where: { idempotencyKey: string } }) =>
        outbox.find((r) => r.idempotencyKey === a.where.idempotencyKey) ?? null,
    ),
    createMany: jest.fn(
      async (a: { data: { idempotencyKey: string; nextAttemptAt: Date; payload: unknown }[] }) => {
        const d = a.data[0];
        if (outbox.some((r) => r.idempotencyKey === d.idempotencyKey)) return { count: 0 };
        outbox.push({ idempotencyKey: d.idempotencyKey, status: 'pending', createdAt: new Date() });
        return { count: 1 };
      },
    ),
    update: jest.fn(async (a: { where: { idempotencyKey: string }; data: { status?: string } }) => {
      const r = outbox.find((x) => x.idempotencyKey === a.where.idempotencyKey)!;
      if (a.data.status) r.status = a.data.status;
      return r;
    }),
    deleteMany: jest.fn(async (a: { where: { idempotencyKey: string; status?: string } }) => {
      const before = outbox.length;
      for (let i = outbox.length - 1; i >= 0; i--) {
        const r = outbox[i];
        if (
          r.idempotencyKey === a.where.idempotencyKey &&
          (!a.where.status || r.status === a.where.status)
        ) {
          outbox.splice(i, 1);
        }
      }
      return { count: before - outbox.length };
    }),
  };
  const leaderboardWeekPost = {
    findUnique: jest.fn(
      async (a: { where: { weekId: string } }) =>
        posts.find((p) => p.weekId === a.where.weekId) ?? null,
    ),
    upsert: jest.fn(async (a: { create: { weekId: string; discordMessageId: string } }) => {
      posts.push({ ...a.create, postedAt: new Date(), updatedAt: new Date() });
    }),
    update: jest.fn(async (a: { where: { weekId: string }; data: { updatedAt: Date } }) => {
      const p = posts.find((x) => x.weekId === a.where.weekId)!;
      p.updatedAt = a.data.updatedAt;
      return p;
    }),
    delete: jest.fn(async (a: { where: { weekId: string } }) => {
      posts.splice(
        posts.findIndex((p) => p.weekId === a.where.weekId),
        1,
      );
    }),
  };
  const prisma = {
    outboxEvent,
    leaderboardWeekPost,
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  } as unknown as PrismaService;
  const leaderboard = { ranked: jest.fn(async () => opts.rows ?? [row('u1', 1, 6)]) };
  const links = { discordIdsOf: jest.fn(async () => opts.links ?? new Map([['u1', A]])) };
  const poster = {
    enabled: opts.enabled ?? true,
    post: jest.fn(async () => ({ messageId: MSG as string | null })),
    edit: jest.fn(async (_id: string, _message: unknown) => {}),
  };
  const events = { emitAsync: jest.fn(async () => []) };
  const service = new WeeklyLeaderboardService(
    prisma,
    { now: () => opts.now ?? MONDAY_9 } as Clock,
    leaderboard as unknown as LeaderboardService,
    links as unknown as DiscordLinkService,
    poster,
    { WEB_ORIGIN: 'https://learn.example.org' } as Env,
    events as unknown as EventEmitter2,
  );
  return { service, outbox, posts, outboxEvent, leaderboard, links, poster, events };
}

describe('WeeklyLeaderboardService: Monday job (learning-hub#76)', () => {
  it('queues one post for last week with the week key, from the 7-day board', async () => {
    const { service, outboxEvent, leaderboard } = setup({
      rows: [row('u1', 1, 6), row('u2', 2, 3)],
    });
    await expect(service.scheduleDue()).resolves.toBe(true);
    expect(leaderboard.ranked).toHaveBeenCalledWith(
      new Date('2026-11-15T17:00:00Z'),
      new Date('2026-11-22T17:00:00Z'),
    );
    const { data, skipDuplicates } = outboxEvent.createMany.mock.calls[0][0] as unknown as {
      data: { type: string; idempotencyKey: string; payload: { mentionUserIds: string[] } }[];
      skipDuplicates: boolean;
    };
    expect(skipDuplicates).toBe(true);
    expect(data[0].type).toBe(OutboxTypes.LeaderboardWeek);
    expect(data[0].idempotencyKey).toBe(KEY);
    expect(data[0].payload.mentionUserIds).toEqual([A]);
  });

  it('does nothing when the week is already queued (rerun, or an admin posted by hand)', async () => {
    const { service, outboxEvent, leaderboard } = setup({
      outbox: [{ idempotencyKey: KEY, status: 'sent' }],
    });
    await expect(service.scheduleDue()).resolves.toBe(false);
    expect(leaderboard.ranked).not.toHaveBeenCalled();
    expect(outboxEvent.createMany).not.toHaveBeenCalled();
  });

  it('posts nothing for an empty week, outside Monday 09:00 or without a webhook', async () => {
    await expect(setup({ rows: [] }).service.scheduleDue()).resolves.toBe(false);
    await expect(setup({ now: WEDNESDAY }).service.scheduleDue()).resolves.toBe(false);
    const off = setup({ enabled: false });
    await expect(off.service.scheduleDue()).resolves.toBe(false);
    expect(off.outboxEvent.findUnique).not.toHaveBeenCalled();
  });
});

describe('WeeklyLeaderboardService: admin post and update (learning-hub#83)', () => {
  it('"Đăng ngay" posts last week once, keeps the message id and writes the audit event', async () => {
    const { service, poster, outbox, posts, events } = setup({ now: WEDNESDAY });
    const status = await service.postNow('admin-1');

    expect(poster.post).toHaveBeenCalledTimes(1);
    expect(outbox).toEqual([expect.objectContaining({ idempotencyKey: KEY, status: 'sent' })]);
    expect(posts[0]).toMatchObject({ weekId: '2026-W47', discordMessageId: MSG });
    expect(events.emitAsync).toHaveBeenCalledWith(LeaderboardPostEvents.Posted, {
      actorId: 'admin-1',
      weekId: '2026-W47',
      members: 1,
    });
    expect(status.state).toBe('posted');
  });

  it('a second "Đăng ngay" posts nothing and says to use "Cập nhật"', async () => {
    const { service, poster } = setup({ now: WEDNESDAY });
    await service.postNow('admin-1');
    await expect(service.postNow('admin-1')).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(poster.post).toHaveBeenCalledTimes(1);
  });

  it('the Monday job and the button share the key: whoever is second writes nothing', async () => {
    // admin first, then the job at 09:00 the same Monday
    const a = setup();
    await a.service.postNow('admin-1');
    await expect(a.service.scheduleDue()).resolves.toBe(false);
    expect(a.outbox).toHaveLength(1);

    // job first (queued, not yet sent), then the admin
    const b = setup();
    await b.service.scheduleDue();
    await expect(b.service.postNow('admin-1')).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(b.poster.post).not.toHaveBeenCalled();
    expect(b.outbox).toHaveLength(1);
  });

  it('writes the manual row as not due yet, so the worker cannot send it at the same time', async () => {
    const { service, outboxEvent } = setup({ now: WEDNESDAY });
    await service.postNow('admin-1');
    const { data } = outboxEvent.createMany.mock.calls[0][0] as { data: { nextAttemptAt: Date }[] };
    expect(data[0].nextAttemptAt.getTime()).toBeGreaterThan(WEDNESDAY.getTime());
  });

  it('when Discord fails, leaves the row due for the worker and reports it', async () => {
    const { service, poster, outboxEvent, posts } = setup({ now: WEDNESDAY });
    poster.post.mockRejectedValueOnce(new Error('HTTP 500'));
    await expect(service.postNow('admin-1')).rejects.toMatchObject({ code: 'UPSTREAM_ERROR' });
    expect(outboxEvent.update).toHaveBeenCalledWith({
      where: { idempotencyKey: KEY },
      data: expect.objectContaining({ nextAttemptAt: WEDNESDAY }),
    });
    expect(posts).toHaveLength(0);
  });

  it('lets a week the worker gave up on (failed) be posted by hand', async () => {
    const { service, poster } = setup({
      now: WEDNESDAY,
      outbox: [{ idempotencyKey: KEY, status: 'failed' }],
    });
    await expect(service.status()).resolves.toMatchObject({ state: 'not_posted' });
    await service.postNow('admin-1');
    expect(poster.post).toHaveBeenCalledTimes(1);
  });

  it('refuses to post an empty week or without a webhook', async () => {
    await expect(setup({ now: WEDNESDAY, rows: [] }).service.postNow('a')).rejects.toBeInstanceOf(
      DomainError,
    );
    await expect(setup({ enabled: false }).service.postNow('a')).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('"Cập nhật" recomputes and edits the same Discord message, with an audit event', async () => {
    const { service, poster, events, links } = setup({
      now: WEDNESDAY,
      rows: [row('u1', 1, 9), row('u2', 2, 3)],
      posted: [{ weekId: '2026-W47', discordMessageId: MSG }],
    });
    const status = await service.update('admin-1');

    expect(poster.post).not.toHaveBeenCalled();
    expect(poster.edit).toHaveBeenCalledWith(MSG, expect.objectContaining({ mentionUserIds: [A] }));
    const edited = poster.edit.mock.calls[0][1] as { embeds: { description: string }[] };
    expect(edited.embeds[0].description).toContain('9 điểm');
    expect(links.discordIdsOf).toHaveBeenCalledWith(['u1', 'u2']);
    expect(events.emitAsync).toHaveBeenCalledWith(LeaderboardPostEvents.Updated, {
      actorId: 'admin-1',
      weekId: '2026-W47',
      members: 2,
    });
    expect(status.updatedAt).toBe(WEDNESDAY.toISOString());
  });

  it('"Cập nhật" before anything was posted is refused', async () => {
    const { service, poster } = setup({ now: WEDNESDAY });
    await expect(service.update('admin-1')).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(poster.edit).not.toHaveBeenCalled();
  });

  it('a message deleted on Discord (404) frees the week, so "Đăng ngay" can post again', async () => {
    const { service, poster, outbox, posts } = setup({
      now: WEDNESDAY,
      outbox: [{ idempotencyKey: KEY, status: 'sent' }],
      posted: [{ weekId: '2026-W47', discordMessageId: MSG }],
    });
    poster.edit.mockRejectedValueOnce(new ClubPostGoneError());

    await expect(service.update('admin-1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(posts).toHaveLength(0);
    expect(outbox).toHaveLength(0);
    await expect(service.status()).resolves.toMatchObject({ state: 'not_posted' });

    await service.postNow('admin-1');
    expect(poster.post).toHaveBeenCalledTimes(1);
  });

  it('other edit errors keep the post record (try again later)', async () => {
    const { service, poster, posts } = setup({
      now: WEDNESDAY,
      posted: [{ weekId: '2026-W47', discordMessageId: MSG }],
    });
    poster.edit.mockRejectedValueOnce(new Error('HTTP 500'));
    await expect(service.update('admin-1')).rejects.toThrow('HTTP 500');
    expect(posts).toHaveLength(1);
  });
});
