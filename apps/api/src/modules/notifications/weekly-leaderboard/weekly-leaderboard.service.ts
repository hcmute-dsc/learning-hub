import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { Clock } from '../../../infrastructure/clock';
import { ENV, type Env } from '../../../infrastructure/config/env';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { LeaderboardService } from '../../leaderboard/leaderboard.service';
import { DiscordLinkService } from '../../users/discord-link.service';
import { OutboxTypes } from '../outbox/outbox';
import { CLUB_POSTER, type ClubPoster } from '../ports/notification-channel';
import { buildWeeklyPost, dueWeek, WEEKLY_TOP, weekKey } from './weekly-post';

/**
 * Queues the weekly leaderboard post (learning-hub#76). Called by the outbox worker's
 * housekeeping (every 10 minutes); it does something only on Monday from 09:00 Vietnam
 * time. The row's idempotency key `leaderboard-week:<YYYY-Www>` makes every rerun that
 * week a no-op, and the outbox worker delivers it with retries.
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
  ) {}

  /** true when a post was queued by this call. */
  async scheduleDue(): Promise<boolean> {
    if (!this.poster.enabled) return false;
    const week = dueWeek(this.clock.now());
    if (!week) return false;
    const key = weekKey(week);
    const queued = await this.prisma.outboxEvent.findUnique({
      where: { idempotencyKey: key },
      select: { id: true },
    });
    if (queued) return false;

    // Same rules as /leaderboard (opted-in members only), over the 7 days of the week.
    const rows = (await this.leaderboard.ranked(week.startsAt, week.endsAt)).slice(0, WEEKLY_TOP);
    const discordIds = await this.discordLinks.discordIdsOf(rows.map((r) => r.user.id));
    const post = buildWeeklyPost({ week, rows, discordIds, hubUrl: this.env.WEB_ORIGIN });
    if (!post) return false; // an empty week posts nothing

    // skipDuplicates: a second process racing on the same key writes nothing.
    const { count } = await this.prisma.outboxEvent.createMany({
      data: [
        {
          type: OutboxTypes.LeaderboardWeek,
          payload: post as unknown as Prisma.InputJsonValue,
          idempotencyKey: key,
        },
      ],
      skipDuplicates: true,
    });
    if (count) {
      this.logger.log({ week: week.id, members: rows.length }, 'Weekly leaderboard queued');
    }
    return count === 1;
  }
}
