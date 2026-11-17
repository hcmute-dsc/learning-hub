import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { ExerciseStateService } from './exercise-state.service';
import { ExercisesController } from './exercises.controller';
import { ExercisesService } from './exercises.service';
import { SubmissionReviewService } from './submission-review.service';
import { SubmissionWriter } from './submission-writer';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';

/**
 * E5: exercises (view, quiz, self-check) and submissions. Depends on catalog only.
 * Exports ExerciseStateService for the learning module (learning → submissions → catalog)
 * and SubmissionReviewService for the reviews module (reviews → submissions). The
 * finished reviews shown on a member's attempts come through the COMPLETED_REVIEWS port
 * (ports/completed-reviews.ts), which the reviews module binds.
 *
 * Files, by job:
 *   exercise-state.ts   the one rule for how an exercise looks to a member
 *   grading.ts          quiz grading (pure)
 *   submission-url.ts   which submission URLs are accepted (pure, SECURITY §3)
 *   submit-rules.ts     when a member may submit, idempotency, who may read (pure)
 *   exercise-view.ts / submission-view.ts   database rows → API contract (pure)
 *   submission-writer.ts  the only code that inserts submissions (attempt numbers, events)
 *   submission-review.service.ts  queue + review outcome for the reviews module (E7)
 */
@Module({
  imports: [CatalogModule],
  controllers: [ExercisesController, SubmissionsController],
  providers: [
    ExerciseStateService,
    ExercisesService,
    SubmissionsService,
    SubmissionWriter,
    SubmissionReviewService,
  ],
  exports: [ExerciseStateService, SubmissionReviewService],
})
export class SubmissionsModule {}
