import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ENV, type Env } from '../../infrastructure/config/env';
import { CatalogReader } from '../catalog/catalog.reader';
import { ContentEvents, type ContentPublishedEvent } from '../content/content.events';
import { ReviewEvents, type ReviewCompletedEvent } from '../reviews/reviews.events';
import { SubmissionEvents, type SubmissionEvent } from '../submissions/submissions.events';
import { UsersService } from '../users/users.service';
import { awaitingReviewMessage, contentPublishedMessage, reviewCompletedMessage } from './messages';
import { CLUB_CHANNEL, type NotificationChannel } from './ports/notification-channel';

/**
 * Club channel notifications (E9). Each handler returns at once and does the lookups
 * and the send in the background: emitAsync awaits listeners, and a member's submit
 * must never wait for (or fail because of) Discord.
 */
@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(
    @Inject(CLUB_CHANNEL) private readonly channel: NotificationChannel,
    @Inject(ENV) private readonly env: Env,
    private readonly catalog: CatalogReader,
    private readonly users: UsersService,
  ) {}

  @OnEvent(SubmissionEvents.AwaitingReview)
  onAwaitingReview(e: SubmissionEvent): void {
    this.inBackground('awaiting_review', async () => {
      const [exercise, member] = await Promise.all([
        this.catalog.exercise(e.exerciseId),
        this.users.getMe(e.userId),
      ]);
      return awaitingReviewMessage(this.env.WEB_ORIGIN, {
        submissionId: e.submissionId,
        exerciseTitle: exercise.title,
        trackTitle: exercise.track.title,
        memberLogin: member.githubLogin,
      });
    });
  }

  @OnEvent(ReviewEvents.Completed)
  onReviewCompleted(e: ReviewCompletedEvent): void {
    this.inBackground('review_completed', async () => {
      const [exercise, member] = await Promise.all([
        this.catalog.exercise(e.exerciseId),
        this.users.getMe(e.memberId),
      ]);
      return reviewCompletedMessage({
        exerciseTitle: exercise.title,
        trackTitle: exercise.track.title,
        memberLogin: member.githubLogin,
        outcome: e.outcome,
      });
    });
  }

  @OnEvent(ContentEvents.Published)
  onContentPublished(e: ContentPublishedEvent): void {
    this.inBackground('content_published', async () =>
      contentPublishedMessage(this.env.WEB_ORIGIN, {
        commitSha: e.commitSha,
        sourceRepo: e.sourceRepo,
        previousCommitSha: e.previousCommitSha,
        tracks: e.changes.tracks,
        removed: e.changes.removed,
      }),
    );
  }

  /** Build and send without blocking the caller; errors are logged, never thrown. */
  private inBackground(kind: string, build: () => Promise<string>): void {
    if (!this.channel.enabled) return; // skip the lookups when Discord is off
    void build()
      .then((content) => this.channel.send(content))
      .catch((err) => this.logger.warn({ err, kind }, 'Notification not sent'));
  }
}
