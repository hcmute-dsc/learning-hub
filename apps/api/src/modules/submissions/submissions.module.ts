import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { ExerciseStateService } from './exercise-state.service';

/**
 * E5: exercises (view, quiz, self-check) and submissions. Depends on catalog only.
 * Exports ExerciseStateService for the learning module (learning → submissions → catalog).
 */
@Module({
  imports: [CatalogModule],
  controllers: [],
  providers: [ExerciseStateService],
  exports: [ExerciseStateService],
})
export class SubmissionsModule {}
