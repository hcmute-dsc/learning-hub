import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TERM_ID_PATTERN } from '@hub/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser } from '../../common/auth.decorators';
import { ZodPipe } from '../../common/zod';
import { LeaderboardService } from './leaderboard.service';

const querySchema = z.object({ term: z.string().regex(TERM_ID_PATTERN).optional() }).strict();

/** Opt-in leaderboard of the term, for `/leaderboard` (E14). Signed-in active members only. */
@ApiTags('leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  @Get()
  get(
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(querySchema)) query: z.infer<typeof querySchema>,
  ) {
    return this.leaderboard.forViewer(user.id, query.term).then((data) => ({ data }));
  }
}
