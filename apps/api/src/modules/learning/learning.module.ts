import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { SubmissionsModule } from '../submissions/submissions.module';
import { CompletionListener } from './completion.listener';
import { EnrollmentRepository } from './enrollment.repository';
import { EnrollmentService } from './enrollment.service';
import { EnrollmentsController } from './enrollments.controller';
import { LessonProgressRepository } from './lesson-progress.repository';
import { LessonService } from './lesson.service';
import { LessonsController } from './lessons.controller';
import { MyEnrollmentsController } from './my-enrollments.controller';
import { ProgressService } from './progress.service';

/**
 * E4: enrollments, lesson pages, lesson progress, track progress, "continue" item.
 * Depends on catalog (content) and submissions (exercise states). Nothing depends on it.
 */
@Module({
  imports: [CatalogModule, SubmissionsModule],
  controllers: [EnrollmentsController, MyEnrollmentsController, LessonsController],
  providers: [
    EnrollmentRepository,
    LessonProgressRepository,
    ProgressService,
    EnrollmentService,
    LessonService,
    CompletionListener,
  ],
})
export class LearningModule {}
