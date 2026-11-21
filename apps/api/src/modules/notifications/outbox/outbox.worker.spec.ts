import type { Clock } from '../../../infrastructure/clock';
import type { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { DigestService } from '../digest/digest.service';
import type { InboxService } from '../inbox/inbox.service';
import type { WeeklyLeaderboardService } from '../weekly-leaderboard/weekly-leaderboard.service';
import type { NotificationDispatcher } from './notification-dispatcher';
import { MAX_ATTEMPTS } from './outbox';
import { OutboxWorker, type ClaimedRow } from './outbox.worker';

const NOW = new Date('2026-11-18T10:00:00Z');

function setup(rows: ClaimedRow[] = []) {
  const outboxEvent = { update: jest.fn(async (_args: unknown) => ({})) };
  const prisma = {
    outboxEvent,
    $queryRaw: jest.fn(async () => rows),
  } as unknown as PrismaService;
  const dispatcher = { dispatch: jest.fn(async () => {}) };
  const digest = { scheduleDue: jest.fn(async () => 0) };
  const inbox = { pruneOld: jest.fn(async () => 0) };
  const weekly = { scheduleDue: jest.fn(async () => false) };
  const worker = new OutboxWorker(
    prisma,
    { now: () => NOW } as Clock,
    dispatcher as unknown as NotificationDispatcher,
    digest as unknown as DigestService,
    inbox as unknown as InboxService,
    weekly as unknown as WeeklyLeaderboardService,
  );
  return { worker, outboxEvent, dispatcher, digest, inbox, weekly };
}

const row = (attempts = 1): ClaimedRow => ({
  id: 10n,
  type: 'inbox.track_published',
  payload: { slug: 'git', title: 'Git' },
  attempts,
});

describe('OutboxWorker', () => {
  it('marks a row sent after it is dispatched', async () => {
    const { worker, outboxEvent, dispatcher } = setup([row()]);
    expect(await worker.processDue()).toBe(1);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(10n, 'inbox.track_published', {
      slug: 'git',
      title: 'Git',
    });
    expect(outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 10n },
      data: { status: 'sent', lastError: null },
    });
  });

  it('schedules a retry and records the error when dispatch fails', async () => {
    const { worker, outboxEvent, dispatcher } = setup([row(1)]);
    dispatcher.dispatch.mockRejectedValueOnce(new Error('smtp down'));
    await worker.processDue();
    expect(outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 10n },
      data: {
        status: 'pending',
        nextAttemptAt: new Date(NOW.getTime() + 60_000),
        lastError: 'Error: smtp down',
      },
    });
  });

  it('gives up after the last attempt', async () => {
    const { worker, outboxEvent, dispatcher } = setup([row(MAX_ATTEMPTS)]);
    dispatcher.dispatch.mockRejectedValueOnce(new Error('still down'));
    await worker.processDue();
    expect(outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 10n },
      data: { status: 'failed', lastError: 'Error: still down' },
    });
  });

  it('schedules digests and prunes on the first pass, never throws', async () => {
    const { worker, digest, inbox } = setup();
    digest.scheduleDue.mockRejectedValueOnce(new Error('db down'));
    await expect(worker.tick()).resolves.toBeUndefined();
    expect(digest.scheduleDue).toHaveBeenCalledTimes(1);
    await worker.tick();
    // housekeeping runs every 10 minutes, not on every poll
    expect(digest.scheduleDue).toHaveBeenCalledTimes(1);
    expect(inbox.pruneOld).toHaveBeenCalledTimes(0);
  });

  it('asks for the weekly leaderboard post during housekeeping (learning-hub#76)', async () => {
    const { worker, weekly, inbox } = setup();
    await worker.tick();
    expect(weekly.scheduleDue).toHaveBeenCalledTimes(1);
    expect(inbox.pruneOld).toHaveBeenCalledTimes(1);
  });
});
