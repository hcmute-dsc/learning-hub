import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../common/errors';
import { CatalogReader } from '../../catalog/catalog.reader';
import { UsersService } from '../../users/users.service';
import { DigestService } from '../digest/digest.service';
import {
  reviewCompletedNotice,
  reviewRequestedNotice,
  trackPublishedNotice,
} from '../inbox/inbox-messages';
import { InboxService } from '../inbox/inbox.service';
import {
  OutboxTypes,
  type EmailDigestPayload,
  type ReviewCompletedPayload,
  type ReviewRequestedPayload,
  type TrackPublishedPayload,
} from './outbox';

/**
 * Does the work of one outbox row (BACKEND-DESIGN "NotificationDispatcher"): find the
 * recipients, build the text, write the bell rows or send the email. Throws to ask the
 * worker for a retry.
 */
@Injectable()
export class NotificationDispatcher {
  constructor(
    private readonly catalog: CatalogReader,
    private readonly users: UsersService,
    private readonly inbox: InboxService,
    private readonly digest: DigestService,
  ) {}

  async dispatch(eventId: bigint, type: string, payload: unknown): Promise<void> {
    try {
      await this.run(eventId, type, payload);
    } catch (err) {
      // The exercise was archived after the event: nothing to link to, so nothing to do.
      if (err instanceof DomainError && err.code === 'NOT_FOUND') return;
      throw err;
    }
  }

  private async run(eventId: bigint, type: string, payload: unknown): Promise<void> {
    switch (type) {
      case OutboxTypes.ReviewCompleted: {
        const p = payload as ReviewCompletedPayload;
        const exercise = await this.catalog.exercise(p.exerciseId);
        const notice = reviewCompletedNotice({
          exerciseId: p.exerciseId,
          exerciseTitle: exercise.title,
          trackTitle: exercise.track.title,
          outcome: p.outcome,
        });
        await this.inbox.deliver(eventId, [p.memberId], notice);
        return;
      }
      case OutboxTypes.ReviewRequested: {
        const p = payload as ReviewRequestedPayload;
        const [exercise, mentors] = await Promise.all([
          this.catalog.exercise(p.exerciseId),
          this.users.activeIds(['mentor']),
        ]);
        const notice = reviewRequestedNotice({
          submissionId: p.submissionId,
          exerciseTitle: exercise.title,
          trackTitle: exercise.track.title,
        });
        const recipients = mentors.filter((id) => id !== p.memberId);
        await this.inbox.deliver(eventId, recipients, notice);
        return;
      }
      case OutboxTypes.TrackPublished: {
        const p = payload as TrackPublishedPayload;
        const members = await this.users.activeIds();
        await this.inbox.deliver(eventId, members, trackPublishedNotice(p));
        return;
      }
      case OutboxTypes.EmailDigest:
        await this.digest.send(payload as EmailDigestPayload);
        return;
      default:
        throw new Error(`Unknown outbox type ${type}`);
    }
  }
}
