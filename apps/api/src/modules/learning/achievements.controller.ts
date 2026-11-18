import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/auth.decorators';
import { AchievementService } from './achievement.service';

/** The signed-in member's badges and streak, for `/dashboard` (PRD F12). */
@ApiTags('learning')
@Controller('me/achievements')
export class AchievementsController {
  constructor(private readonly achievements: AchievementService) {}

  /** `{ data: null }` when the member hid achievements in /settings. */
  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.achievements.mine(user.id).then((data) => ({ data }));
  }
}
