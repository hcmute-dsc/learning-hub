import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  LEADERBOARD_PERIODS,
  TERM_ID_PATTERN,
  TRACK_SLUG_PATTERN,
  WEEK_ID_PATTERN,
} from '@hub/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser } from '../../common/auth.decorators';
import { ZodPipe } from '../../common/zod';
import { LeaderboardService } from './leaderboard.service';

const querySchema = z
  .object({
    period: z.enum(LEADERBOARD_PERIODS).optional(),
    term: z.string().regex(TERM_ID_PATTERN).optional(),
    week: z.string().regex(WEEK_ID_PATTERN).optional(),
    track: z.string().regex(TRACK_SLUG_PATTERN).optional(),
  })
  .strict();

/**
 * Opt-in leaderboard of a term or a week, optionally one track, for `/leaderboard` and its
 * share image (E14, learning-hub#88). Signed-in active members only.
 */
@ApiTags('leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  @Get()
  get(
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(querySchema)) query: z.infer<typeof querySchema>,
  ) {
    return this.leaderboard.forViewer(user.id, query).then((data) => ({ data }));
  }
}
