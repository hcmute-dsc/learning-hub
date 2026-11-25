import { Injectable } from '@nestjs/common';
import {
  TRACK_STATS_ACTIVE_DAYS,
  TRACK_STATS_TOP,
  type TrackStats,
  type TrackStatsDays,
} from '@hub/shared';
import type { AuthUser } from '../../common/auth.decorators';
import { DomainError } from '../../common/errors';
import { Clock } from '../../infrastructure/clock';
import { dayStart, resolvePeriod } from './period';
import { ReportsRepository } from './reports.repository';
import {
  canViewTrackStats,
  funnel,
  hardestByFirstAttempt,
  inactiveLearners,
  progressHistogram,
  recentWeeks,
  statsPeriods,
  trackTotals,
  waitingReviews,
  weekly,
} from './track-stats';
import { TrackStatsRepository } from './track-stats.repository';

/**
 * Statistics of one track (learning-hub#118, #126) for admins and mentors, every track. The
 * totals reuse the progress report's facts for the last `days` Vietnam days (and the `days`
 * before them, for the comparison), so they equal
 * `/admin/reports?track=<slug>&from=<period.from>&to=<period.to>`.
 */
@Injectable()
export class TrackStatsService {
  constructor(
    private readonly reports: ReportsRepository,
    private readonly repo: TrackStatsRepository,
    private readonly clock: Clock,
  ) {}

  async stats(
    viewer: AuthUser,
    slug: string,
    days: TrackStatsDays = TRACK_STATS_ACTIVE_DAYS,
  ): Promise<TrackStats> {
    // The controller's @Roles('mentor') already stops members; checked again here so the
    // rule does not depend on a decorator alone. Before the lookup: members learn nothing.
    if (!canViewTrackStats(viewer.roles)) {
      throw DomainError.forbidden('Chỉ admin và mentor xem được thống kê track.');
    }
    const track = await this.repo.trackBySlug(slug);
    if (!track) throw DomainError.notFound('Track');

    const now = this.clock.now();
    const ranges = statsPeriods(now, days);
    // Both fit in REPORT_MAX_DAYS (the longest option is 90 days), so never null.
    const period = resolvePeriod(ranges.current, now)!;
    const before = resolvePeriod(ranges.previous, now)!;
    const weeks = recentWeeks(now);
    const filter = { startsAt: period.startsAt, endsAt: period.endsAt, trackId: track.id };
    const previousFilter = { startsAt: before.startsAt, endsAt: before.endsAt, trackId: track.id };

    const [
      facts,
      reviews,
      previousFacts,
      previousReviews,
      outline,
      done,
      attempts,
      waiting,
      activity,
    ] = await Promise.all([
      this.reports.memberFacts(filter),
      this.reports.reviewFacts(filter),
      this.reports.memberFacts(previousFilter),
      this.reports.reviewFacts(previousFilter),
      this.repo.outline(track.id),
      this.repo.doneItems(track.id),
      this.repo.firstAttempts(track.id),
      this.repo.waitingReviews(track.id, TRACK_STATS_TOP),
      this.repo.activity(track.id, dayStart(weeks[0])!),
    ]);

    return {
      track: { slug: track.slug, title: track.title },
      generatedAt: now.toISOString(),
      period: { from: period.from, to: period.to, days },
      totals: trackTotals(facts, reviews),
      previous: {
        period: { from: before.from, to: before.to },
        totals: trackTotals(previousFacts, previousReviews),
      },
      progress: progressHistogram(facts),
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
