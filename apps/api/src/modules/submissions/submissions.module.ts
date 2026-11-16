import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { ExerciseStateService } from './exercise-state.service';
import { ExercisesController } from './exercises.controller';
import { ExercisesService } from './exercises.service';
import { SubmissionWriter } from './submission-writer';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';

/**
 * E5: exercises (view, quiz, self-check) and submissions. Depends on catalog only.
 * Exports ExerciseStateService for the learning module (learning → submissions → catalog).
 *
 * Files, by job:
 *   exercise-state.ts   the one rule for how an exercise looks to a member
 *   grading.ts          quiz grading (pure)
 *   submission-url.ts   which submission URLs are accepted (pure, SECURITY §3)
 *   submit-rules.ts     when a member may submit, idempotency, who may read (pure)
 *   exercise-view.ts / submission-view.ts   database rows → API contract (pure)
 *   submission-writer.ts  the only code that inserts submissions (attempt numbers, events)
 */
@Module({
  imports: [CatalogModule],
  controllers: [ExercisesController, SubmissionsController],
  providers: [ExerciseStateService, ExercisesService, SubmissionsService, SubmissionWriter],
  exports: [ExerciseStateService],
})
export class SubmissionsModule {}
