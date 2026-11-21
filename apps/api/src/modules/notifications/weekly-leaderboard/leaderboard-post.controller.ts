import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, Roles } from '../../../common/auth.decorators';
import { WeeklyLeaderboardService } from './weekly-leaderboard.service';

/**
 * Admin "Bảng xếp hạng tuần" (learning-hub#83): see last week's Discord post, post it
 * now, or edit it after a recompute. Both actions are written to the audit log.
 */
@ApiTags('admin')
@Controller('admin/leaderboard-post')
export class LeaderboardPostController {
  constructor(private readonly weekly: WeeklyLeaderboardService) {}

  @Get()
  @Roles('admin')
  status() {
    return this.weekly.status().then((data) => ({ data }));
  }

  @Post('post')
  @Roles('admin')
  @HttpCode(200)
  post(@CurrentUser() actor: AuthUser) {
    return this.weekly.postNow(actor.id).then((data) => ({ data }));
  }

  @Post('update')
  @Roles('admin')
  @HttpCode(200)
  update(@CurrentUser() actor: AuthUser) {
    return this.weekly.update(actor.id).then((data) => ({ data }));
  }
}
