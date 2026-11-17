import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '@hub/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser, Roles } from '../../common/auth.decorators';
import { ZodPipe } from '../../common/zod';
import { UsersService } from './users.service';

const setRolesSchema = z.object({ roles: z.array(z.enum(ROLES)).max(ROLES.length) });

@ApiTags('admin')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  /** All accounts with their emails: admin only (personal data, SECURITY §1). */
  @Get()
  @Roles('admin')
  listAll() {
    return this.users.listAllForAdmin().then((data) => ({ data }));
  }

  @Get('pending')
  @Roles('mentor')
  listPending() {
    return this.users.listPending().then((data) => ({ data }));
  }

  @Post(':id/approve')
  @Roles('mentor')
  @HttpCode(204)
  approve(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.approve(actor.id, id);
  }

  @Put(':id/roles')
  @Roles('admin')
  @HttpCode(204)
  setRoles(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(setRolesSchema)) body: z.infer<typeof setRolesSchema>,
  ) {
    return this.users.setRoles(actor.id, id, body.roles);
  }
}
