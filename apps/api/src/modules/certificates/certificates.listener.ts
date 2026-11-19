import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LearningEvents, type TrackCompletedEvent } from '../learning/learning.events';
import { CertificatesService } from './certificates.service';

/**
 * Issues the certificate when learning stores a track as completed (emitted once per
 * enrollment). A failure is logged and never breaks the request that completed the
 * track (CONTRIBUTING rule 6); the member's next visit to /settings or their profile
 * issues it then (CertificatesService.issueMissing).
 */
@Injectable()
export class CertificatesListener {
  private readonly logger = new Logger(CertificatesListener.name);

  constructor(private readonly certificates: CertificatesService) {}

  @OnEvent(LearningEvents.TrackCompleted)
  async onTrackCompleted(event: TrackCompletedEvent): Promise<void> {
    try {
      await this.certificates.issue(event.userId, event.trackId, new Date(event.completedAt));
    } catch (err) {
      this.logger.error({ err, enrollmentId: event.enrollmentId }, 'Failed to issue certificate');
    }
  }
}
