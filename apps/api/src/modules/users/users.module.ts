import { Module } from '@nestjs/common';
import { ApprovedEmailsController } from './approved-emails.controller';
import { ApprovedEmailsService } from './approved-emails.service';
import { MeController } from './me.controller';
import { AdminUsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [AdminUsersController, ApprovedEmailsController, MeController],
  providers: [UsersService, ApprovedEmailsService],
  exports: [UsersService],
})
export class UsersModule {}
