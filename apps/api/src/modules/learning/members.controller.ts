import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AuthUser, CurrentUser } from '../../common/auth.decorators';
import { ZodPipe } from '../../common/zod';
import { ProfileService } from './profile.service';

/** GitHub login rules: letters, digits and single hyphens, at most 39 characters. */
const loginPipe = new ZodPipe(
  z
    .string()
    .regex(/^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/)
    .max(39),
);

/** Member profiles, visible to signed-in approved members only (global guard). */
@ApiTags('learning')
@Controller('members')
export class MembersController {
  constructor(private readonly profiles: ProfileService) {}

  @Get(':login')
  get(@CurrentUser() viewer: AuthUser, @Param('login', loginPipe) login: string) {
    return this.profiles.byLogin(viewer.id, login).then((data) => ({ data }));
  }
}
