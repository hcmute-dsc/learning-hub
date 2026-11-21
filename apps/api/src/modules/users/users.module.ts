import { Module } from '@nestjs/common';
import { DiscordIntegrationModule } from '../../integrations/discord/discord.module';
import { DiscordLinkController } from './discord-link.controller';
import { DiscordLinkService } from './discord-link.service';
import { ApprovedEmailsController } from './approved-emails.controller';
import { ApprovedEmailsService } from './approved-emails.service';
import { MeController } from './me.controller';
import { AdminUsersController } from './users.controller';
import { PeopleReader } from './people.reader';
import { UsersService } from './users.service';

@Module({
  imports: [DiscordIntegrationModule],
  controllers: [
    AdminUsersController,
    ApprovedEmailsController,
    MeController,
    DiscordLinkController,
  ],
  providers: [UsersService, ApprovedEmailsService, PeopleReader, DiscordLinkService],
  exports: [UsersService, PeopleReader, DiscordLinkService],
})
export class UsersModule {}
