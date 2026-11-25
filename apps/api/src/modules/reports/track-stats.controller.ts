import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TRACK_SLUG_PATTERN } from '@hub/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser, Roles } from '../../common/auth.decorators';
import { ZodPipe } from '../../common/zod';
import { TrackStatsService } from './track-stats.service';

const slugSchema = z.string().max(80).regex(TRACK_SLUG_PATTERN);

/**
 * "Thống kê" of one track (learning-hub#118, INFORMATION-ARCHITECTURE "Thống kê track").
 * The mentor role is checked here (admin always passes); which tracks a mentor may see is
 * checked in TrackStatsService (`canViewTrackStats`), because it depends on the track.
 */
@ApiTags('reports')
@Roles('mentor')
@Controller('tracks/:slug/stats')
export class TrackStatsController {
  constructor(private readonly service: TrackStatsService) {}

  @Get()
  get(@CurrentUser() user: AuthUser, @Param('slug', new ZodPipe(slugSchema)) slug: string) {
    return this.service.stats(user, slug).then((data) => ({ data }));
  }

  /** Cheap check for the track page, so the link shows only to people who may open it. */
  @Get('access')
  access(@CurrentUser() user: AuthUser, @Param('slug', new ZodPipe(slugSchema)) slug: string) {
    return this.service.access(user, slug).then((data) => ({ data }));
  }
}
