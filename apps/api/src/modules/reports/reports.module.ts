import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsRepository } from './reports.repository';
import { ReportsService } from './reports.service';

/**
 * Progress report and CSV export for admins (learning-hub#34). Reads enrollments, progress,
 * submissions and reviews with counting queries and stores nothing; exports are audited
 * through ReportEvents. Imports no other business module.
 */
@Module({
  controllers: [ReportsController],
  providers: [ReportsRepository, ReportsService],
})
export class ReportsModule {}
