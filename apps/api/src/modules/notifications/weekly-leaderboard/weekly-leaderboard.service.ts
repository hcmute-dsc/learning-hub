import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Prisma } from '@prisma/client';
import type { LeaderboardPostStatus, LeaderboardRow } from '@hub/shared';
import { DomainError } from '../../../common/errors';
import { Clock } from '../../../infrastructure/clock';
import { ENV, type Env } from '../../../infrastructure/config/env';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { LeaderboardService } from '../../leaderboard/leaderboard.service';
import { DiscordLinkService } from '../../users/discord-link.service';
import { errorText, OutboxTypes } from '../outbox/outbox';
import { CLUB_POSTER, ClubPostGoneError, type ClubPoster } from '../ports/notification-channel';
import { LeaderboardPostEvents, type LeaderboardPostEvent } from './weekly-leaderboard.events';
import {
  buildWeeklyPost,
  dueWeek,
  previousWeek,
  WEEKLY_TOP,
  weekKey,
  type Week,
  type WeeklyPost,
} from './weekly-post';

/**
 * How long a row written by "Đăng ngay" stays out of the worker's reach while the
 * request itself posts it, so the two never send the same week at once.
 */
const MANUAL_LEASE_MS = 10 * 60_000;

/**
 * The weekly leaderboard post on the club channel.
 *
 * - learning-hub#76: the outbox worker's housekeeping (every 10 minutes) calls
 *   scheduleDue, which does something only on Monday from 09:00 Vietnam time.
 * - learning-hub#83: an admin can post last week now ("Đăng ngay") or recompute it and
 *   edit the message already on Discord ("Cập nhật").
 *
 * Every path writes the outbox row with the key `leaderboard-week:<YYYY-Www>`, so the
 * job and the button never post the same week twice. The Discord message id is kept in
 * leaderboard_week_posts for edits.
 */
@Injectable()
export class WeeklyLeaderboardService {
  private readonly logger = new Logger(WeeklyLeaderboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly leaderboard: LeaderboardService,
    private readonly discordLinks: DiscordLinkService,
    @Inject(CLUB_POSTER) private readonly poster: ClubPoster,
    @Inject(ENV) private readonly env: Env,
    private readonly events: EventEmitter2,
  ) {}

  /** Job: true when a post was queued by this call. */
  async scheduleDue(): Promise<boolean> {
    if (!this.poster.enabled) return false;
    const week = dueWeek(this.clock.now());
    if (!week) return false;
    const key = weekKey(week);
    const queued = await this.prisma.outboxEvent.findUnique({
      where: { idempotencyKey: key },
      select: { id: true },
    });
    if (queued) return false; // already queued, posted by the job or by an admin

    const { post, rows } = await this.build(week);
    if (!post) return false; // an empty week posts nothing

    const created = await this.queue(post, key, this.clock.now());
    if (created) {
      this.logger.log({ week: week.id, members: rows.length }, 'Weekly leaderboard queued');
    }
    return created;
  }

  /** Dispatcher, after Discord accepted a post: keep its message id for later edits. */
  async recordPosted(weekId: string, messageId: string | null): Promise<void> {
    if (!messageId) return;
    await this.prisma.leaderboardWeekPost.upsert({
      where: { weekId },
      create: { weekId, discordMessageId: messageId },
      update: { discordMessageId: messageId },
    });
  }

  /** Admin page: where last week's post stands, and who would be in it now. */
  async status(): Promise<LeaderboardPostStatus> {
    const week = previousWeek(this.clock.now());
    const [record, row, preview] = await Promise.all([
      this.prisma.leaderboardWeekPost.findUnique({ where: { weekId: week.id } }),
      this.prisma.outboxEvent.findUnique({
        where: { idempotencyKey: weekKey(week) },
        select: { status: true, createdAt: true },
      }),
      this.topOf(week),
    ]);
    // A row the worker gave up on counts as not posted: "Đăng ngay" may try again.
    const state = record ? 'posted' : row && row.status !== 'failed' ? 'queued' : 'not_posted';
    return {
      weekId: week.id,
      startsAt: week.startsAt.toISOString(),
      endsAt: week.endsAt.toISOString(),
      enabled: this.poster.enabled,
      state,
      postedAt: record?.postedAt.toISOString() ?? null,
      updatedAt:
        record && record.updatedAt > record.postedAt ? record.updatedAt.toISOString() : null,
      preview,
    };
  }

  /**
   * "Đăng ngay": post last week now, without waiting for Monday. Refused when the week
   * is already queued or posted (use "Cập nhật"), or when nobody is on the board.
   * When Discord fails, the row stays in the outbox and the worker retries it.
   */
  async postNow(actorId: string): Promise<LeaderboardPostStatus> {
    this.assertEnabled();
    const now = this.clock.now();
    const week = previousWeek(now);
    const { post, rows } = await this.build(week);
    if (!post)
      throw DomainError.conflict('Tuần trước chưa có ai trên bảng xếp hạng, không có gì để đăng.');

    // A row the worker gave up on (8 failed attempts) must not block posting by hand.
    await this.prisma.outboxEvent.deleteMany({
      where: { idempotencyKey: weekKey(week), status: 'failed' },
    });
    // Written as not due yet, so the worker leaves it alone while this request posts it.
    const created = await this.queue(
      post,
      weekKey(week),
      new Date(now.getTime() + MANUAL_LEASE_MS),
    );
    if (!created) {
      throw DomainError.conflict(
        'Tuần này đã được đăng hoặc đang chờ đăng. Dùng "Cập nhật" để sửa bài.',
      );
    }

    let messageId: string | null;
    try {
      ({ messageId } = await this.poster.post(post));
    } catch (err) {
      // Hand it to the worker: due now, retried with backoff like any outbox row.
      await this.prisma.outboxEvent.update({
        where: { idempotencyKey: weekKey(week) },
        data: { nextAttemptAt: this.clock.now(), attempts: 1, lastError: errorText(err) },
      });
      await this.emit(LeaderboardPostEvents.Posted, actorId, week, rows.length);
      throw new DomainError(
        'UPSTREAM_ERROR',
        502,
        'Discord chưa nhận bài. Bài đã vào hàng đợi và sẽ được thử lại tự động.',
      );
    }
    // The post is on Discord now. Bookkeeping must never hand the row back to the worker,
    // or the week would be posted twice; a failure here only loses the "Cập nhật" link.
    try {
      await this.prisma.outboxEvent.update({
        where: { idempotencyKey: weekKey(week) },
        data: { status: 'sent', attempts: 1, lastError: null },
      });
      await this.recordPosted(week.id, messageId);
    } catch (err) {
      this.logger.error({ err, week: week.id }, 'Weekly post sent, bookkeeping failed');
    }
    await this.emit(LeaderboardPostEvents.Posted, actorId, week, rows.length);
    return this.status();
  }

  /**
   * "Cập nhật": recompute last week and edit the message already on Discord. Editing
   * pings nobody. A message deleted on Discord frees the week, so it can be posted again.
   */
  async update(actorId: string): Promise<LeaderboardPostStatus> {
    this.assertEnabled();
    const week = previousWeek(this.clock.now());
    const record = await this.prisma.leaderboardWeekPost.findUnique({ where: { weekId: week.id } });
    if (!record) {
      throw DomainError.conflict('Tuần này chưa có bài trên Discord để cập nhật.');
    }
    const { post, rows } = await this.build(week);
    if (!post) {
      throw DomainError.conflict(
        'Bảng tuần này giờ không còn ai (đã tắt bảng xếp hạng), nên không sửa bài.',
      );
    }
    try {
      await this.poster.edit(record.discordMessageId, post);
    } catch (err) {
      if (!(err instanceof ClubPostGoneError)) throw err;
      // Deleted on Discord: forget it, so "Đăng ngay" can post the week again.
      await this.prisma.$transaction([
        this.prisma.leaderboardWeekPost.delete({ where: { weekId: week.id } }),
        this.prisma.outboxEvent.deleteMany({ where: { idempotencyKey: weekKey(week) } }),
      ]);
      throw new DomainError(
        'NOT_FOUND',
        404,
        'Bài trên Discord đã bị xoá. Bấm "Đăng ngay" để đăng lại.',
      );
    }
    await this.prisma.leaderboardWeekPost.update({
      where: { weekId: week.id },
      data: { updatedAt: this.clock.now() },
    });
    await this.emit(LeaderboardPostEvents.Updated, actorId, week, rows.length);
    return this.status();
  }

  private assertEnabled(): void {
    if (!this.poster.enabled) {
      throw DomainError.conflict('Chưa cấu hình webhook kênh CLB (DISCORD_WEBHOOK_URL).');
    }
  }

  /** Same rules as /leaderboard (opted-in members only), over the 7 days of the week. */
  private async topOf(week: Week): Promise<LeaderboardRow[]> {
    return (await this.leaderboard.ranked(week.startsAt, week.endsAt)).slice(0, WEEKLY_TOP);
  }

  private async build(week: Week): Promise<{ post: WeeklyPost | null; rows: LeaderboardRow[] }> {
    const rows = await this.topOf(week);
    const discordIds = await this.discordLinks.discordIdsOf(rows.map((r) => r.user.id));
    return { post: buildWeeklyPost({ week, rows, discordIds, hubUrl: this.env.WEB_ORIGIN }), rows };
  }

  /** skipDuplicates: whoever loses the race on the week key writes nothing (false). */
  private async queue(post: WeeklyPost, key: string, nextAttemptAt: Date): Promise<boolean> {
    const { count } = await this.prisma.outboxEvent.createMany({
      data: [
        {
          type: OutboxTypes.LeaderboardWeek,
          payload: post as unknown as Prisma.InputJsonValue,
          idempotencyKey: key,
          nextAttemptAt,
        },
      ],
      skipDuplicates: true,
    });
    return count === 1;
  }

  private async emit(type: string, actorId: string, week: Week, members: number): Promise<void> {
    const event: LeaderboardPostEvent = { actorId, weekId: week.id, members };
    await this.events.emitAsync(type, event);
  }
}
