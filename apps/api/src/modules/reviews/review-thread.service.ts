import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  PROFILE_THANKS_LIMIT,
  type PublicThanks,
  type ReviewMessage,
  type ReviewThanksView,
  type ReviewThread,
} from '@hub/shared';
import type { AuthUser } from '../../common/auth.decorators';
import { DomainError } from '../../common/errors';
import { newId } from '../../infrastructure/ids';
import { isUniqueViolation } from '../../infrastructure/prisma/errors';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SubmissionReviewService } from '../submissions/submission-review.service';
import { PeopleReader } from '../users/people.reader';
import { UsersService } from '../users/users.service';
import { ReviewRecords } from './review-records';
import {
  assertCanPost,
  assertCanRead,
  assertCanSetThanksVisibility,
  assertCanThank,
  authorRole,
  canThank,
  postBlocker,
  type ThreadParties,
} from './review-thread-rules';
import { unknownPerson } from './review-view';
import { ReviewEvents, type ReviewThreadEvent } from './reviews.events';

/** One review with the two people it is between. */
interface ThreadContext {
  reviewId: string;
  submissionId: string;
  exerciseId: string;
  status: string;
  parties: ThreadParties;
}

const THANKS_SELECT = { body: true, isPublic: true, createdAt: true } as const;

function toThanks(row: { body: string; isPublic: boolean; createdAt: Date }): ReviewThanksView {
  return { body: row.body, isPublic: row.isPublic, createdAt: row.createdAt.toISOString() };
}

/**
 * The conversation on a finished review and the member's thank-you note (learning-hub#41).
 * Messages are `review_comments` rows without a file or line. Who may do what is in
 * review-thread-rules.ts; the bell is told through ReviewEvents.MessagePosted / ThanksSent.
 */
@Injectable()
export class ReviewThreadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly records: ReviewRecords,
    private readonly submissions: SubmissionReviewService,
    private readonly people: PeopleReader,
    private readonly users: UsersService,
    private readonly events: EventEmitter2,
  ) {}

  async thread(viewer: AuthUser, reviewId: string): Promise<ReviewThread> {
    const ctx = await this.context(reviewId);
    const role = assertCanRead(viewer, ctx.parties);
    const [rows, thanks] = await Promise.all([
      this.prisma.reviewComment.findMany({
        where: { reviewId, filePath: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true, authorId: true, bodyMd: true, createdAt: true },
      }),
      this.prisma.reviewThanks.findUnique({ where: { reviewId }, select: THANKS_SELECT }),
    ]);
    const people = await this.people.byIds(rows.map((r) => r.authorId));
    const messages = rows.map((r) =>
      this.toMessage(r, people.get(r.authorId) ?? unknownPerson(r.authorId), ctx),
    );
    return {
      reviewId,
      viewerRole: role,
      messages,
      canPost: postBlocker(ctx.status, messages.length) === null,
      thanks: thanks ? toThanks(thanks) : null,
      canThank: canThank(role, ctx.status, thanks !== null),
      canShowThanks: thanks !== null && viewer.id === ctx.parties.reviewerId,
    };
  }

  async post(viewer: AuthUser, reviewId: string, bodyMd: string): Promise<ReviewMessage> {
    const ctx = await this.context(reviewId);
    const messageCount = await this.prisma.reviewComment.count({
      where: { reviewId, filePath: null },
    });
    assertCanPost(viewer, ctx.parties, { status: ctx.status, messageCount });

    const row = await this.prisma.reviewComment.create({
      data: { id: newId(), reviewId, authorId: viewer.id, bodyMd },
      select: { id: true, authorId: true, bodyMd: true, createdAt: true },
    });
    await this.events.emitAsync(ReviewEvents.MessagePosted, this.event(ctx, viewer.id));
    const author = (await this.people.byIds([viewer.id])).get(viewer.id);
    return this.toMessage(row, author ?? unknownPerson(viewer.id), ctx);
  }

  async thank(viewer: AuthUser, reviewId: string, body: string): Promise<ReviewThanksView> {
    const ctx = await this.context(reviewId);
    const existing = await this.prisma.reviewThanks.count({ where: { reviewId } });
    assertCanThank(viewer, ctx.parties, { status: ctx.status, alreadyThanked: existing > 0 });

    let row;
    try {
      row = await this.prisma.reviewThanks.create({
        data: {
          id: newId(),
          reviewId,
          menteeId: ctx.parties.memberId,
          mentorId: ctx.parties.reviewerId,
          body,
        },
        select: THANKS_SELECT,
      });
    } catch (err) {
      // Two clicks at once: the unique review_id keeps one note.
      if (!isUniqueViolation(err)) throw err;
      throw DomainError.conflict('Bạn đã cảm ơn mentor cho review này rồi.');
    }
    await this.events.emitAsync(ReviewEvents.ThanksSent, this.event(ctx, viewer.id));
    return toThanks(row);
  }

  async setThanksVisibility(
    viewer: AuthUser,
    reviewId: string,
    isPublic: boolean,
  ): Promise<ReviewThanksView> {
    const ctx = await this.context(reviewId);
    assertCanSetThanksVisibility(viewer, ctx.parties);
    const updated = await this.prisma.reviewThanks.updateMany({
      where: { reviewId },
      data: { isPublic },
    });
    if (updated.count === 0) throw DomainError.notFound('Thanks');
    const row = await this.prisma.reviewThanks.findUniqueOrThrow({
      where: { reviewId },
      select: THANKS_SELECT,
    });
    return toThanks(row);
  }

  /** Notes a mentor chose to show, for their profile. 404 like the profile itself. */
  async publicFor(login: string): Promise<PublicThanks[]> {
    const mentor = await this.users.findActiveByLogin(login);
    if (!mentor) throw DomainError.notFound('Member');
    const rows = await this.prisma.reviewThanks.findMany({
      where: { mentorId: mentor.id, isPublic: true },
      orderBy: { createdAt: 'desc' },
      take: PROFILE_THANKS_LIMIT,
      select: { id: true, body: true, menteeId: true, createdAt: true },
    });
    const people = await this.people.byIds(rows.map((r) => r.menteeId));
    return rows.map((r) => ({
      id: r.id,
      body: r.body,
      from: people.get(r.menteeId) ?? unknownPerson(r.menteeId),
      createdAt: r.createdAt.toISOString(),
    }));
  }

  private async context(reviewId: string): Promise<ThreadContext> {
    const review = await this.records.findById(reviewId);
    if (!review) throw DomainError.notFound('Review');
    const owner = await this.submissions.owner(review.submissionId);
    return {
      reviewId: review.id,
      submissionId: review.submissionId,
      exerciseId: owner.exerciseId,
      status: review.status,
      parties: { memberId: owner.userId, reviewerId: review.reviewerId },
    };
  }

  private toMessage(
    row: { id: string; authorId: string; bodyMd: string; createdAt: Date },
    author: ReviewMessage['author'],
    ctx: ThreadContext,
  ): ReviewMessage {
    return {
      id: row.id,
      author,
      role: authorRole(row.authorId, ctx.parties),
      bodyMd: row.bodyMd,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private event(ctx: ThreadContext, authorId: string): ReviewThreadEvent {
    return {
      reviewId: ctx.reviewId,
      submissionId: ctx.submissionId,
      exerciseId: ctx.exerciseId,
      memberId: ctx.parties.memberId,
      reviewerId: ctx.parties.reviewerId,
      authorId,
    };
  }
}
