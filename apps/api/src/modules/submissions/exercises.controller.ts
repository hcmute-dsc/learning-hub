import { Body, Controller, Get, Headers, HttpCode, Param, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  linkSubmissionSchema,
  quizAttemptSchema,
  selfCheckSchema,
  type LinkSubmissionInput,
  type QuizAttemptInput,
} from '@hub/shared';
import type { Response } from 'express';
import { z } from 'zod';
import { AuthUser, CurrentUser } from '../../common/auth.decorators';
import { ZodPipe } from '../../common/zod';
import { ExercisesService } from './exercises.service';
import { HintsService } from './hints.service';
import { SubmissionsService } from './submissions.service';
import { parseIdempotencyKey } from './submit-rules';

/** Malformed ids are a 422 like every other validation error (BACKEND-DESIGN §3.4). */
const idPipe = new ZodPipe(z.string().uuid());
const hintPositionPipe = new ZodPipe(z.coerce.number().int().min(1).max(99));

/** SECURITY §4: submitting is limited to 10 requests per minute. */
const SUBMIT_LIMIT = { default: { limit: 10, ttl: 60_000 } };

/** E5 endpoints under /exercises/:id. Any signed-in active member (global guard). */
@ApiTags('exercises')
@Controller('exercises')
export class ExercisesController {
  constructor(
    private readonly exercises: ExercisesService,
    private readonly submissions: SubmissionsService,
    private readonly hints: HintsService,
  ) {}

  @Get(':id')
  view(@CurrentUser() user: AuthUser, @Param('id', idPipe) id: string) {
    return this.exercises.view(user, id).then((data) => ({ data }));
  }

  /**
   * Open one hint (PRD F11): 201 the first time, 200 when it was already open. Hints open
   * in order and only after `cost` attempts (rules in hints.ts).
   */
  @Post(':id/hints/:position')
  @Throttle(SUBMIT_LIMIT)
  async openHint(
    @CurrentUser() user: AuthUser,
    @Param('id', idPipe) id: string,
    @Param('position', hintPositionPipe) position: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { created, hint } = await this.hints.open(user, id, position);
    res.status(created ? 201 : 200);
    return { data: hint };
  }

  @Post(':id/quiz-attempts')
  @Throttle(SUBMIT_LIMIT)
  attemptQuiz(
    @CurrentUser() user: AuthUser,
    @Param('id', idPipe) id: string,
    @Body(new ZodPipe(quizAttemptSchema)) body: QuizAttemptInput,
  ) {
    return this.exercises.attemptQuiz(user.id, id, body).then((data) => ({ data }));
  }

  /** 201 when a submission is created, 200 when the exercise was already completed. */
  @Post(':id/self-check')
  @Throttle(SUBMIT_LIMIT)
  async selfCheck(
    @CurrentUser() user: AuthUser,
    @Param('id', idPipe) id: string,
    @Body(new ZodPipe(selfCheckSchema)) _body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { created, submission } = await this.exercises.selfCheck(user.id, id);
    res.status(created ? 201 : 200);
    return { data: submission };
  }

  /** 202 for a new submission (checks/review happen later), 200 for a same-key retry. */
  @Post(':id/submissions')
  @Throttle(SUBMIT_LIMIT)
  @HttpCode(202)
  async submitLink(
    @CurrentUser() user: AuthUser,
    @Param('id', idPipe) id: string,
    @Headers('idempotency-key') idempotencyHeader: string | undefined,
    @Body(new ZodPipe(linkSubmissionSchema)) body: LinkSubmissionInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const key = parseIdempotencyKey(idempotencyHeader);
    const { replayed, submission } = await this.submissions.submitLink(user, id, body, key);
    if (replayed) res.status(200);
    return { data: submission };
  }
}
