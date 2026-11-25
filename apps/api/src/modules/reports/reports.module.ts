import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsRepository } from './reports.repository';
import { ReportsService } from './reports.service';
import { TrackStatsController } from './track-stats.controller';
import { TrackStatsRepository } from './track-stats.repository';
import { TrackStatsService } from './track-stats.service';

/**
 * Progress report and CSV export for admins (learning-hub#34), and the statistics of one
 * track for admins and its mentors (learning-hub#118). Reads enrollments, progress,
 * submissions, reviews and mentor assignments with counting queries and stores nothing;
 * exports are audited through ReportEvents. Imports no other business module.
 */
@Module({
  controllers: [ReportsController, TrackStatsController],
  providers: [ReportsRepository, ReportsService, TrackStatsRepository, TrackStatsService],
})
export class ReportsModule {}
