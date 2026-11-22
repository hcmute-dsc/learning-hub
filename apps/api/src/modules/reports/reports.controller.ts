import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  reportExportQuerySchema,
  reportQuerySchema,
  type ReportExportQuery,
  type ReportQuery,
} from '@hub/shared';
import type { Response } from 'express';
import { AuthUser, CurrentUser, Roles } from '../../common/auth.decorators';
import { ZodPipe } from '../../common/zod';
import { ReportsService } from './reports.service';

/**
 * Admin "Báo cáo" (learning-hub#34, INFORMATION-ARCHITECTURE §9): progress per track and
 * cohort for a period, and the same tables as CSV. Admin only, like the email list.
 */
@ApiTags('admin')
@Roles('admin')
@Controller('admin/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  get(@Query(new ZodPipe(reportQuerySchema)) query: ReportQuery) {
    return this.reports.report(query).then((data) => ({ data }));
  }

  /** A plain link downloads it: GET, same-origin cookie, `Content-Disposition: attachment`. */
  @Get('export')
  async export(
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(reportExportQuerySchema)) query: ReportExportQuery,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const file = await this.reports.exportCsv(user.id, query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.setHeader('Cache-Control', 'no-store');
    return file.body;
  }
}
