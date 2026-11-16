import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { GithubIntegrationModule } from '../../integrations/github/github.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { SessionGuard } from './auth.guard';
import { SessionService } from './session.service';

@Module({
  imports: [UsersModule, GithubIntegrationModule],
  controllers: [AuthController],
  providers: [SessionService, { provide: APP_GUARD, useClass: SessionGuard }],
  exports: [SessionService],
})
export class IdentityModule {}
