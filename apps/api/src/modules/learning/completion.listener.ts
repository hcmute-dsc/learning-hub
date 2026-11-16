import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CatalogReader } from '../catalog/catalog.reader';
import { SubmissionEvents, type SubmissionEvent } from '../submissions/submissions.events';
import { EnrollmentService } from './enrollment.service';

/**
 * Records track completion when an exercise passes, so completed_at is the real date
 * even if the member never opens the dashboard (BACKEND-DESIGN §2 learning, §5:
 * learning listens to SubmissionPassed). Failures are logged and never break the
 * submission request (CONTRIBUTING rule 6).
 */
@Injectable()
export class CompletionListener {
  private readonly logger = new Logger(CompletionListener.name);

  constructor(
    private readonly catalog: CatalogReader,
    private readonly enrollments: EnrollmentService,
  ) {}

  @OnEvent(SubmissionEvents.Passed)
  async onSubmissionPassed(event: SubmissionEvent): Promise<void> {
    try {
      const exercise = await this.catalog.exercise(event.exerciseId);
      await this.enrollments.refreshCompletion(event.userId, exercise.track.id);
    } catch (err) {
      this.logger.error({ err, submissionId: event.submissionId }, 'Failed to record completion');
    }
  }
}
