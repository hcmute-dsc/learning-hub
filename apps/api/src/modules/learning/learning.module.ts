import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { SubmissionsModule } from '../submissions/submissions.module';

/**
 * E4: enrollments, lesson pages, lesson progress, track progress, "continue" item.
 * Depends on catalog (content) and submissions (exercise states). Nothing depends on it.
 */
@Module({
  imports: [CatalogModule, SubmissionsModule],
  controllers: [],
  providers: [],
})
export class LearningModule {}
