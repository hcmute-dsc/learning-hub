import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { Clock } from '../../../infrastructure/clock';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { DigestService } from '../digest/digest.service';
import { InboxService } from '../inbox/inbox.service';
import { NotificationDispatcher } from './notification-dispatcher';
import { afterFailure, errorText, OUTBOX_TYPES } from './outbox';

export interface ClaimedRow {
  id: bigint;
  type: string;
  payload: unknown;
  /** already counts this attempt */
  attempts: number;
}

const POLL_MS = 15_000;
/** Digest scheduling and pruning old rows are cheap but need not run every poll. */
const HOUSEKEEPING_MS = 10 * 60_000;
const BATCH = 20;
/** A claimed row that never settles (process killed) is picked up again after this. */
const LEASE = '10 minutes';

/**
 * Background loop over `outbox_events` (learning-hub#49). Started from main.ts only, so
 * the content:sync CLI and the tests never run it. One API process runs in production
 * (deploy/README.md); `FOR UPDATE SKIP LOCKED` keeps it safe if there were two.
 */
@Injectable()
export class OutboxWorker implements OnApplicationShutdown {
  private readonly logger = new Logger(OutboxWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private lastHousekeeping = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly dispatcher: NotificationDispatcher,
    private readonly digest: DigestService,
    private readonly inbox: InboxService,
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), POLL_MS);
    this.timer.unref();
    void this.tick();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** One pass; never throws. Skipped while the previous pass is still running. */
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const now = this.clock.now().getTime();
      if (now - this.lastHousekeeping >= HOUSEKEEPING_MS) {
        this.lastHousekeeping = now;
        await this.digest.scheduleDue();
        await this.inbox.pruneOld();
      }
      await this.processDue();
    } catch (err) {
      this.logger.error({ err }, 'Outbox pass failed');
    } finally {
      this.running = false;
    }
  }

  /** Claim a batch of due rows and settle each one. Returns how many were claimed. */
  async processDue(): Promise<number> {
    const rows = await this.claim();
    for (const row of rows) await this.settle(row);
    return rows.length;
  }

  /**
   * Count the attempt and push next_attempt_at out by the lease in one statement, so a
   * crash mid-way leaves the row to be retried instead of lost.
   */
  private claim(): Promise<ClaimedRow[]> {
    return this.prisma.$queryRaw<ClaimedRow[]>`
      UPDATE outbox_events
         SET attempts = attempts + 1,
             next_attempt_at = now() + ${LEASE}::interval
       WHERE id IN (
             SELECT id FROM outbox_events
              WHERE status = 'pending'
                AND next_attempt_at <= now()
                AND type = ANY(${OUTBOX_TYPES}::text[])
              ORDER BY id
              LIMIT ${BATCH}
                FOR UPDATE SKIP LOCKED)
      RETURNING id, type, payload, attempts`;
  }

  async settle(row: ClaimedRow): Promise<void> {
    try {
      await this.dispatcher.dispatch(row.id, row.type, row.payload);
      await this.prisma.outboxEvent.update({
        where: { id: row.id },
        data: { status: 'sent', lastError: null },
      });
    } catch (err) {
      const next = afterFailure(row.attempts, this.clock.now());
      this.logger.warn({ err, id: String(row.id), type: row.type, ...next }, 'Outbox row failed');
      await this.prisma.outboxEvent
        .update({ where: { id: row.id }, data: { ...next, lastError: errorText(err) } })
        .catch((e) => this.logger.error({ err: e }, 'Could not record the outbox failure'));
    }
  }
}
