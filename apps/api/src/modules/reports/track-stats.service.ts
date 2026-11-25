import { Injectable } from '@nestjs/common';
import { TRACK_STATS_ACTIVE_DAYS, TRACK_STATS_TOP, type TrackStats } from '@hub/shared';
import type { AuthUser } from '../../common/auth.decorators';
import { DomainError } from '../../common/errors';
import { Clock } from '../../infrastructure/clock';
import { dayStart, resolvePeriod, vietnamDay } from './period';
import { ReportsRepository } from './reports.repository';
import {
  canViewTrackStats,
  funnel,
  hardestByFirstAttempt,
  inactiveLearners,
  recentWeeks,
  trackTotals,
  waitingReviews,
  weekly,
} from './track-stats';
import { TrackStatsRepository } from './track-stats.repository';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Statistics of one track (learning-hub#118) for admins and the track's mentors. The totals
 * reuse the progress report's facts for the last 14 Vietnam days, so they equal
 * `/admin/reports?track=<slug>&from=<period.from>&to=<period.to>`.
 */
@Injectable()
export class TrackStatsService {
  constructor(
    private readonly reports: ReportsRepository,
    private readonly repo: TrackStatsRepository,
    private readonly clock: Clock,
  ) {}

  async stats(viewer: AuthUser, slug: string): Promise<TrackStats> {
    const track = await this.repo.trackBySlug(slug);
    if (!track) throw DomainError.notFound('Track');
    // The controller's @Roles('mentor') already stops members; checked again here so the
    // rule does not depend on a decorator alone.
    if (!canViewTrackStats(viewer.roles)) {
      throw DomainError.forbidden('Chỉ admin và mentor xem được thống kê track.');
    }

    const now = this.clock.now();
    const today = vietnamDay(now);
    const from = vietnamDay(
      new Date(dayStart(today)!.getTime() - (TRACK_STATS_ACTIVE_DAYS - 1) * DAY_MS),
    );
    const period = resolvePeriod({ from, to: today }, now)!;
    const weeks = recentWeeks(now);
    const filter = { startsAt: period.startsAt, endsAt: period.endsAt, trackId: track.id };

    const [facts, reviews, outline, done, attempts, waiting, activity] = await Promise.all([
      this.reports.memberFacts(filter),
      this.reports.reviewFacts(filter),
      this.repo.outline(track.id),
      this.repo.doneItems(track.id),
      this.repo.firstAttempts(track.id),
      this.repo.waitingReviews(track.id, TRACK_STATS_TOP),
      this.repo.activity(track.id, dayStart(weeks[0])!),
    ]);

    return {
      track: { slug: track.slug, title: track.title },
      generatedAt: now.toISOString(),
      period: { from: period.from, to: period.to },
      totals: trackTotals(facts, reviews),
      funnel: funnel(outline, done),
      hardest: {
        firstAttempt: hardestByFirstAttempt(outline, attempts),
        waitingReviews: waitingReviews(waiting, now),
      },
      weekly: weekly(weeks, facts, activity),
      inactive: inactiveLearners(facts, now),
    };
  }
}
