import { Module } from '@nestjs/common';
import { ApprovedEmailsController } from './approved-emails.controller';
import { ApprovedEmailsService } from './approved-emails.service';
import { MeController } from './me.controller';
import { AdminUsersController } from './users.controller';
import { PeopleReader } from './people.reader';
import { UsersService } from './users.service';

@Module({
  controllers: [AdminUsersController, ApprovedEmailsController, MeController],
  providers: [UsersService, ApprovedEmailsService, PeopleReader],
  exports: [UsersService, PeopleReader],
})
export class UsersModule {}
