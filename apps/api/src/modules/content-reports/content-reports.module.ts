import { Module } from '@nestjs/common';
import { IssueTrackerModule } from '../../integrations/issue-tracker.module';
import { CatalogModule } from '../catalog/catalog.module';
import { ContentReportsController } from './content-reports.controller';
import { ContentReportsService } from './content-reports.service';

/**
 * "Báo lỗi nội dung" (learning-hub#121): table `content_reports`. Depends on `catalog` to
 * resolve what was reported and the track repo; opens GitHub issues through the
 * IssueTracker port. Audit entries and the reporter's bell come from ContentReportEvents.
 */
@Module({
  imports: [CatalogModule, IssueTrackerModule],
  controllers: [ContentReportsController],
  providers: [ContentReportsService],
})
export class ContentReportsModule {}
