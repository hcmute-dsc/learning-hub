import type { LeaderboardRow } from '@hub/shared';
import type { Clock } from '../../../infrastructure/clock';
import type { Env } from '../../../infrastructure/config/env';
import type { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { LeaderboardService } from '../../leaderboard/leaderboard.service';
import type { DiscordLinkService } from '../../users/discord-link.service';
import { OutboxTypes } from '../outbox/outbox';
import { WeeklyLeaderboardService } from './weekly-leaderboard.service';

const MONDAY_9 = new Date('2026-11-23T02:00:00Z');
const A = '111111111111111111';

const row = (id: string, rank: number, score: number): LeaderboardRow => ({
  rank,
  score,
  completed: score,
  user: { id, githubLogin: id, displayName: id, avatarUrl: null },
});

function setup(opts: {
  now?: Date;
  rows?: LeaderboardRow[];
  queued?: boolean;
  enabled?: boolean;
  links?: Map<string, string>;
}) {
  const outboxEvent = {
    findUnique: jest.fn(async () => (opts.queued ? { id: 1n } : null)),
    createMany: jest.fn(async (_args: unknown) => ({ count: 1 })),
  };
  const prisma = { outboxEvent } as unknown as PrismaService;
  const leaderboard = { ranked: jest.fn(async () => opts.rows ?? []) };
  const links = { discordIdsOf: jest.fn(async () => opts.links ?? new Map()) };
  const service = new WeeklyLeaderboardService(
    prisma,
    { now: () => opts.now ?? MONDAY_9 } as Clock,
    leaderboard as unknown as LeaderboardService,
    links as unknown as DiscordLinkService,
    { enabled: opts.enabled ?? true, post: jest.fn() },
    { WEB_ORIGIN: 'https://learn.example.org' } as Env,
  );
  return { service, outboxEvent, leaderboard, links };
}

describe('WeeklyLeaderboardService', () => {
  it('queues one post for last week with the week key, from the 7-day board', async () => {
    const { service, outboxEvent, leaderboard, links } = setup({
      rows: [row('u1', 1, 6), row('u2', 2, 3)],
      links: new Map([['u1', A]]),
    });
    await expect(service.scheduleDue()).resolves.toBe(true);

    expect(leaderboard.ranked).toHaveBeenCalledWith(
      new Date('2026-11-15T17:00:00Z'),
      new Date('2026-11-22T17:00:00Z'),
    );
    expect(links.discordIdsOf).toHaveBeenCalledWith(['u1', 'u2']);
    const { data, skipDuplicates } = outboxEvent.createMany.mock.calls[0][0] as {
      data: { type: string; idempotencyKey: string; payload: { mentionUserIds: string[] } }[];
      skipDuplicates: boolean;
    };
    expect(skipDuplicates).toBe(true);
    expect(data[0].type).toBe(OutboxTypes.LeaderboardWeek);
    expect(data[0].idempotencyKey).toBe('leaderboard-week:2026-W47');
    expect(data[0].payload.mentionUserIds).toEqual([A]);
  });

  it('does nothing when the week is already queued (rerun in the same week)', async () => {
    const { service, outboxEvent, leaderboard } = setup({ queued: true, rows: [row('u1', 1, 3)] });
    await expect(service.scheduleDue()).resolves.toBe(false);
    expect(leaderboard.ranked).not.toHaveBeenCalled();
    expect(outboxEvent.createMany).not.toHaveBeenCalled();
  });

  it('posts nothing for an empty week', async () => {
    const { service, outboxEvent } = setup({ rows: [] });
    await expect(service.scheduleDue()).resolves.toBe(false);
    expect(outboxEvent.createMany).not.toHaveBeenCalled();
  });

  it('does nothing outside Monday 09:00 and without a club webhook', async () => {
    const tuesday = setup({ now: new Date('2026-11-24T02:00:00Z'), rows: [row('u1', 1, 3)] });
    await expect(tuesday.service.scheduleDue()).resolves.toBe(false);
    const off = setup({ enabled: false, rows: [row('u1', 1, 3)] });
    await expect(off.service.scheduleDue()).resolves.toBe(false);
    expect(off.outboxEvent.findUnique).not.toHaveBeenCalled();
  });
});
