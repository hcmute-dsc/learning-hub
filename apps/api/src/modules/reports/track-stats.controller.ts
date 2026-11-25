import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TRACK_SLUG_PATTERN, trackStatsQuerySchema, type TrackStatsDays } from '@hub/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser, Roles } from '../../common/auth.decorators';
import { ZodPipe } from '../../common/zod';
import { TrackStatsService } from './track-stats.service';

const slugSchema = z.string().max(80).regex(TRACK_SLUG_PATTERN);

/**
 * "Thống kê" of one track (learning-hub#118, INFORMATION-ARCHITECTURE "Thống kê track").
 * Admins and mentors, for every track, like the review queue (#30): admin always passes
 * `@Roles`, and TrackStatsService checks the same rule again (`canViewTrackStats`).
 * `?days=7|14|30|90` picks the period (#126); any other value is a 422.
 */
@ApiTags('reports')
@Roles('mentor')
@Controller('tracks/:slug/stats')
export class TrackStatsController {
  constructor(private readonly service: TrackStatsService) {}

  @Get()
  get(
    @CurrentUser() user: AuthUser,
    @Param('slug', new ZodPipe(slugSchema)) slug: string,
    @Query(new ZodPipe(trackStatsQuerySchema)) query: { days: TrackStatsDays },
  ) {
    return this.service.stats(user, slug, query.days).then((data) => ({ data }));
  }
}
