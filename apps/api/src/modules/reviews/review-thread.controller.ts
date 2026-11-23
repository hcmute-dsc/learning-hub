import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  GITHUB_LOGIN_PATTERN,
  reviewMessageSchema,
  reviewThanksSchema,
  reviewThanksVisibilitySchema,
  type ReviewMessageInput,
  type ReviewThanksInput,
  type ReviewThanksVisibilityInput,
} from '@hub/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser } from '../../common/auth.decorators';
import { ZodPipe } from '../../common/zod';
import { ReviewThreadService } from './review-thread.service';

const idPipe = new ZodPipe(z.string().uuid());
const loginPipe = new ZodPipe(z.string().regex(GITHUB_LOGIN_PATTERN));

/**
 * The conversation on a finished review and the thank-you note (learning-hub#41).
 * No @Roles: the member who submitted is usually not a mentor. Who may read and write
 * one conversation is decided per review in review-thread-rules.ts.
 */
@ApiTags('reviews')
@Controller()
export class ReviewThreadController {
  constructor(private readonly threads: ReviewThreadService) {}

  @Get('reviews/:id/thread')
  thread(@CurrentUser() user: AuthUser, @Param('id', idPipe) id: string) {
    return this.threads.thread(user, id).then((data) => ({ data }));
  }

  /** 201; 403 outside the conversation, 409 on a draft review or a full conversation. */
  @Post('reviews/:id/messages')
  post(
    @CurrentUser() user: AuthUser,
    @Param('id', idPipe) id: string,
    @Body(new ZodPipe(reviewMessageSchema)) body: ReviewMessageInput,
  ) {
    return this.threads.post(user, id, body.bodyMd).then((data) => ({ data }));
  }

  /** 201; only the member, once per finished review (409 the second time). */
  @Post('reviews/:id/thanks')
  thank(
    @CurrentUser() user: AuthUser,
    @Param('id', idPipe) id: string,
    @Body(new ZodPipe(reviewThanksSchema)) body: ReviewThanksInput,
  ) {
    return this.threads.thank(user, id, body.body).then((data) => ({ data }));
  }

  /** The mentor shows or hides the note on their profile. */
  @Put('reviews/:id/thanks/visibility')
  setVisibility(
    @CurrentUser() user: AuthUser,
    @Param('id', idPipe) id: string,
    @Body(new ZodPipe(reviewThanksVisibilitySchema)) body: ReviewThanksVisibilityInput,
  ) {
    return this.threads.setThanksVisibility(user, id, body.isPublic).then((data) => ({ data }));
  }

  /** Public notes on a member's profile; any signed-in approved member (global guard). */
  @Get('members/:login/thanks')
  publicThanks(@Param('login', loginPipe) login: string) {
    return this.threads.publicFor(login).then((data) => ({ data }));
  }
}
