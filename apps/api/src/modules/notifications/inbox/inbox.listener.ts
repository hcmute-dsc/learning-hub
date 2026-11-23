import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ContentEvents, type ContentPublishedEvent } from '../../content/content.events';
import {
  ReviewEvents,
  type ReviewCompletedEvent,
  type ReviewThreadEvent,
} from '../../reviews/reviews.events';
import { SubmissionEvents, type SubmissionEvent } from '../../submissions/submissions.events';
import {
  OutboxTypes,
  type OutboxType,
  type ReviewCompletedPayload,
  type ReviewRequestedPayload,
  type ReviewThreadPayload,
  type TrackPublishedPayload,
} from '../outbox/outbox';

/**
 * Turns domain events into `outbox_events` rows for the in-app bell (learning-hub#49).
 * Only ids go in the payload; titles and recipients are looked up by the worker.
 * One small insert per event, awaited so the row exists before the request ends;
 * a failure is logged and never breaks the member's action (CONTRIBUTING rule 6).
 *
 * Discord keeps its own listener (notifications.listener.ts); Web Push (#6) can add
 * its outbox types next to these.
 */
@Injectable()
export class InboxListener {
  private readonly logger = new Logger(InboxListener.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(ReviewEvents.Completed)
  onReviewCompleted(e: ReviewCompletedEvent) {
    const payload: ReviewCompletedPayload = {
      exerciseId: e.exerciseId,
      memberId: e.memberId,
      outcome: e.outcome,
    };
    return this.enqueue(OutboxTypes.ReviewCompleted, payload);
  }

  @OnEvent(ReviewEvents.MessagePosted)
  onReviewMessage(e: ReviewThreadEvent) {
    return this.enqueue(OutboxTypes.ReviewMessage, threadPayload(e));
  }

  @OnEvent(ReviewEvents.ThanksSent)
  onReviewThanks(e: ReviewThreadEvent) {
    return this.enqueue(OutboxTypes.ReviewThanks, threadPayload(e));
  }

  @OnEvent(SubmissionEvents.AwaitingReview)
  onAwaitingReview(e: SubmissionEvent) {
    const payload: ReviewRequestedPayload = {
      submissionId: e.submissionId,
      exerciseId: e.exerciseId,
      memberId: e.userId,
    };
    return this.enqueue(OutboxTypes.ReviewRequested, payload);
  }

  /** Only whole new tracks reach everyone's bell; lesson edits stay on Discord. */
  @OnEvent(ContentEvents.Published)
  async onContentPublished(e: ContentPublishedEvent) {
    for (const track of e.changes.tracks) {
      if (!track.isNew) continue;
      const payload: TrackPublishedPayload = { slug: track.slug, title: track.title };
      await this.enqueue(OutboxTypes.TrackPublished, payload);
    }
  }

  private async enqueue(type: OutboxType, payload: object): Promise<void> {
    try {
      await this.prisma.outboxEvent.create({ data: { type, payload } });
    } catch (err) {
      this.logger.error({ err, type }, 'Could not queue a notification');
    }
  }
}

function threadPayload(e: ReviewThreadEvent): ReviewThreadPayload {
  return {
    submissionId: e.submissionId,
    exerciseId: e.exerciseId,
    memberId: e.memberId,
    reviewerId: e.reviewerId,
    authorId: e.authorId,
  };
}
