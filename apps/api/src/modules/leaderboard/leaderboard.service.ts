import { Inject, Injectable } from '@nestjs/common';
import { LEADERBOARD_TOP, type Leaderboard, type LeaderboardRow } from '@hub/shared';
import { DomainError } from '../../common/errors';
import { Clock } from '../../infrastructure/clock';
import { ENV, type Env } from '../../infrastructure/config/env';
import { LeaderboardRepository } from './leaderboard.repository';
import { rank, topAndMe, type Weights } from './ranking';
import { nextTermId, previousTermId, resolveTerm, termAt } from './term';

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

  /** Every opted-in member with a score in [from, to), ranked. */
  async ranked(from: Date, to: Date): Promise<LeaderboardRow[]> {
    return rank(await this.repo.countsBetween(from, to), this.weights);
  }

  /** GET /leaderboard: the asked term (default: current), top 10 and the viewer's row. */
  async forViewer(viewerId: string, termId?: string): Promise<Leaderboard> {
    const now = this.clock.now();
    const term = resolveTerm(termId, now);
    if (!term) throw DomainError.notFound('Term');
    const [rows, optedIn] = await Promise.all([
      this.ranked(term.startsAt, term.endsAt),
      this.repo.optedIn(viewerId),
    ]);
    const isCurrent = term.id === termAt(now).id;
    return {
      term: {
        id: term.id,
        label: term.label,
        startsAt: term.startsAt.toISOString(),
        endsAt: term.endsAt.toISOString(),
        previousId: previousTermId(term.id),
        nextId: isCurrent ? null : nextTermId(term.id),
      },
      optedIn,
      ...topAndMe(rows, viewerId, LEADERBOARD_TOP),
      weights: this.weights,
    };
  }
}
