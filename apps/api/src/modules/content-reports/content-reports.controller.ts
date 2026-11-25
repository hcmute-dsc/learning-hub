import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  contentReportCountsQuerySchema,
  contentReportQuerySchema,
  createContentReportSchema,
  updateContentReportSchema,
  type ContentReportQuery,
  type CreateContentReportInput,
  type UpdateContentReportInput,
} from '@hub/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser, Roles } from '../../common/auth.decorators';
import { ZodPipe } from '../../common/zod';
import { ContentReportsService } from './content-reports.service';

const idPipe = new ZodPipe(z.string().uuid());

/**
 * "Báo lỗi nội dung" (learning-hub#121, BACKEND-DESIGN). Any signed-in member may send a
 * report; listing and handling need the mentor role (admin always passes), like the review
 * queue. The service checks the same rule again (`canHandleContentReports`).
 */
@ApiTags('content-reports')
@Controller('content-reports')
export class ContentReportsController {
  constructor(private readonly reports: ContentReportsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createContentReportSchema)) body: CreateContentReportInput,
  ) {
    return this.reports.create(user, body).then((data) => ({ data }));
  }

  @Get()
  @Roles('mentor')
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(contentReportQuerySchema)) query: ContentReportQuery,
  ) {
    return this.reports.list(user, query).then((data) => ({ data }));
  }

  @Get('counts')
  @Roles('mentor')
  counts(
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(contentReportCountsQuerySchema)) query: { track?: string },
  ) {
    return this.reports.counts(user, query.track).then((data) => ({ data }));
  }

  @Patch(':id')
  @Roles('mentor')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', idPipe) id: string,
    @Body(new ZodPipe(updateContentReportSchema)) body: UpdateContentReportInput,
  ) {
    return this.reports.update(user, id, body).then((data) => ({ data }));
  }

  @Post(':id/github-issue')
  @Roles('mentor')
  createIssue(@CurrentUser() user: AuthUser, @Param('id', idPipe) id: string) {
    return this.reports.createIssue(user, id).then((data) => ({ data }));
  }
}
