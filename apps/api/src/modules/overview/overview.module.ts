import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ContentModule } from '../content/content.module';
import { SubmissionsModule } from '../submissions/submissions.module';
import { UsersModule } from '../users/users.module';
import { OverviewController } from './overview.controller';
import { OverviewService } from './overview.service';

/** Read-only: asks each owning module for its counts; nothing depends on this module. */
@Module({
  imports: [UsersModule, ContentModule, SubmissionsModule, AuditModule],
  controllers: [OverviewController],
  providers: [OverviewService],
})
export class OverviewModule {}
