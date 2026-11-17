import { Body, Controller, Patch, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { profileUpdateSchema, settingsUpdateSchema, type SettingsUpdateInput } from '@hub/shared';
import type { z } from 'zod';
import { AuthUser, CurrentUser } from '../../common/auth.decorators';
import { ZodPipe } from '../../common/zod';
import { UsersService } from './users.service';

/** The signed-in member's own profile and settings (web page /settings). */
@ApiTags('me')
@Controller('me')
export class MeController {
  constructor(private readonly users: UsersService) {}

  @Patch('profile')
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(profileUpdateSchema)) body: z.output<typeof profileUpdateSchema>,
  ) {
    return this.users.updateProfile(user.id, body).then((data) => ({ data }));
  }

  @Put('settings')
  updateSettings(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(settingsUpdateSchema)) body: SettingsUpdateInput,
  ) {
    return this.users.updateSettings(user.id, body).then((data) => ({ data }));
  }
}
