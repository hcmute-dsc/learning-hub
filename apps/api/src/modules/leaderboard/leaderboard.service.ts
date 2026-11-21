import { Inject, Injectable } from '@nestjs/common';
import {
  LEADERBOARD_TOP,
  type Leaderboard,
  type LeaderboardPeriod,
  type LeaderboardRange,
  type LeaderboardRow,
} from '@hub/shared';
import { DomainError } from '../../common/errors';
import { Clock } from '../../infrastructure/clock';
import { ENV, type Env } from '../../infrastructure/config/env';
import { LeaderboardRepository } from './leaderboard.repository';
import { rank, topAndMe, type Weights } from './ranking';
import { nextTermId, previousTermId, resolveTerm, termAt } from './term';
import { resolveWeek, shiftWeek, weekAt, weekLabel } from './week';

export interface BoardQuery {
  period?: LeaderboardPeriod;
  /** term id, period term */
  term?: string;
  /** week id, period week */
  week?: string;
  /** track slug */
  track?: string;
}

/**
 * Opt-in leaderboard per term (E14, learning-hub#5, DECISIONS ADR-08): top 10 + the
 * viewer's own rank, counted on the fly. Also used for other periods (the weekly
 * Discord post), always with the same rules.
 */
@Injectable()
export class LeaderboardService {
  constructor(
    private readonly repo: LeaderboardRepository,
    private readonly clock: Clock,
    @Inject(ENV) private readonly env: Env,
  ) {}

  get weights(): Weights {
    return {
      graded: this.env.LEADERBOARD_WEIGHT_GRADED,
      selfCheck: this.env.LEADERBOARD_WEIGHT_SELF_CHECK,
    };
  }

  /** Every opted-in member with a score in [from, to), ranked; optionally one track only. */
  async ranked(from: Date, to: Date, trackId?: string): Promise<LeaderboardRow[]> {
    return rank(await this.repo.countsBetween(from, to, trackId), this.weights);
  }

  /**
   * GET /leaderboard: the asked term or week (default: the current term), optionally one
   * track, with the top 10 and the viewer's row.
   */
  async forViewer(viewerId: string, query: BoardQuery = {}): Promise<Leaderboard> {
    const range = resolveRange(query, this.clock.now());
    if (!range) throw DomainError.notFound(query.period === 'week' ? 'Week' : 'Term');
    const track = query.track ? await this.repo.trackBySlug(query.track) : null;
    if (query.track && !track) throw DomainError.notFound('Track');
    const [rows, optedIn] = await Promise.all([
      this.ranked(new Date(range.startsAt), new Date(range.endsAt), track?.id),
      this.repo.optedIn(viewerId),
    ]);
    return {
      range,
      track: track ? { slug: track.slug, title: track.title } : null,
      optedIn,
      ...topAndMe(rows, viewerId, LEADERBOARD_TOP),
      weights: this.weights,
    };
  }
}

/** The term or week of a query, with its neighbours; null when unknown or in the future. */
export function resolveRange(query: BoardQuery, now: Date): LeaderboardRange | null {
  if (query.period === 'week') {
    const week = resolveWeek(query.week, now);
    if (!week) return null;
    const isCurrent = week.id === weekAt(now).id;
    return {
      period: 'week',
      id: week.id,
      label: weekLabel(week),
      startsAt: week.startsAt.toISOString(),
      endsAt: week.endsAt.toISOString(),
      previousId: shiftWeek(week, -1).id,
      nextId: isCurrent ? null : shiftWeek(week, 1).id,
    };
  }
  const term = resolveTerm(query.term, now);
  if (!term) return null;
  return {
    period: 'term',
    id: term.id,
    label: term.label,
    startsAt: term.startsAt.toISOString(),
    endsAt: term.endsAt.toISOString(),
    previousId: previousTermId(term.id),
    nextId: term.id === termAt(now).id ? null : nextTermId(term.id),
  };
}
