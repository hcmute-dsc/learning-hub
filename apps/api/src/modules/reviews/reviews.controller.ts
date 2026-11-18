import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { completeReviewSchema, reviewQueueQuerySchema, type ReviewQueueQuery } from '@hub/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser, Roles } from '../../common/auth.decorators';
import { ZodPipe } from '../../common/zod';
import { ReviewsService } from './reviews.service';

/** Malformed ids are a 422 like every other validation error (BACKEND-DESIGN §3.4). */
const idPipe = new ZodPipe(z.string().uuid());

/**
 * E7 mentor review endpoints. Every route needs the mentor role (admin always passes);
 * who may act on a given review is decided in review-rules.ts.
 */
@ApiTags('reviews')
@Controller()
@Roles('mentor')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  /** ?track=<slug>&mentee=<github login>, both optional; anything else is a 422. */
  @Get('reviews/queue')
  queue(
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(reviewQueueQuerySchema)) query: ReviewQueueQuery,
  ) {
    return this.reviews.queue(user, query).then((data) => ({ data }));
  }

  @Get('reviews/submissions/:submissionId')
  page(@CurrentUser() user: AuthUser, @Param('submissionId', idPipe) submissionId: string) {
    return this.reviews.page(user, submissionId).then((data) => ({ data }));
  }

  /** Claim ("Nhận review") → 201; 409 when not waiting or already claimed, 403 for your own. */
  @Post('submissions/:id/reviews')
  claim(@CurrentUser() user: AuthUser, @Param('id', idPipe) id: string) {
    return this.reviews.claim(user, id).then((data) => ({ data }));
  }

  /** Give the submission back to the queue ("Bỏ nhận"): the reviewer or an admin. */
  @Delete('reviews/:id')
  @HttpCode(204)
  async release(@CurrentUser() user: AuthUser, @Param('id', idPipe) id: string) {
    await this.reviews.release(user, id);
  }

  @Post('reviews/:id/complete')
  @HttpCode(200)
  complete(
    @CurrentUser() user: AuthUser,
    @Param('id', idPipe) id: string,
    @Body(new ZodPipe(completeReviewSchema)) body: z.output<typeof completeReviewSchema>,
  ) {
    return this.reviews.complete(user, id, body).then((data) => ({ data }));
  }
}
