import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { enrollSchema, type EnrollInput } from '@hub/shared';
import type { Response } from 'express';
import { z } from 'zod';
import { AuthUser, CurrentUser } from '../../common/auth.decorators';
import { ZodPipe } from '../../common/zod';
import { EnrollmentService } from './enrollment.service';
import { ProgressService } from './progress.service';

const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(80);

/**
 * Member actions on a track. Shares the `tracks` prefix with the catalog's
 * TracksController; every route here needs a signed-in active member (global guard).
 */
@ApiTags('learning')
@Controller('tracks')
export class EnrollmentsController {
  constructor(
    private readonly enrollments: EnrollmentService,
    private readonly progress: ProgressService,
  ) {}

  /** 201 new enrollment · 200 already enrolled (idempotent, USER-FLOWS §3) */
  @Post(':slug/enrollments')
  async enroll(
    @CurrentUser() user: AuthUser,
    @Param('slug', new ZodPipe(slugSchema)) slug: string,
    @Body(new ZodPipe(enrollSchema)) body: EnrollInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { created, progress } = await this.enrollments.enroll(user.id, slug, body.cohort ?? null);
    res.status(created ? 201 : 200);
    return { data: progress };
  }

  @Get(':slug/progress')
  trackProgress(
    @CurrentUser() user: AuthUser,
    @Param('slug', new ZodPipe(slugSchema)) slug: string,
  ) {
    return this.progress.trackItems(user.id, slug).then((data) => ({ data }));
  }
}
