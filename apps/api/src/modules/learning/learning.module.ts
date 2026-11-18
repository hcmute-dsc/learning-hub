import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { SubmissionsModule } from '../submissions/submissions.module';
import { UsersModule } from '../users/users.module';
import { CompletionListener } from './completion.listener';
import { EnrollmentRepository } from './enrollment.repository';
import { EnrollmentService } from './enrollment.service';
import { EnrollmentsController } from './enrollments.controller';
import { LessonProgressRepository } from './lesson-progress.repository';
import { LessonService } from './lesson.service';
import { LessonsController } from './lessons.controller';
import { MembersController } from './members.controller';
import { MyEnrollmentsController } from './my-enrollments.controller';
import { ProfileService } from './profile.service';
import { ProgressService } from './progress.service';

/**
 * E4: enrollments, lesson pages, lesson progress, track progress, "continue" item.
 * Also the member profile (/members/:login), which adds user facts from users.
 * Depends on catalog (content), submissions (exercise states) and users. Only reviews uses
 * it, for the lesson-progress dates behind "inactive mentees" (LessonProgressRepository).
 */
@Module({
  imports: [CatalogModule, SubmissionsModule, UsersModule],
  controllers: [
    EnrollmentsController,
    MyEnrollmentsController,
    LessonsController,
    MembersController,
  ],
  providers: [
    EnrollmentRepository,
    LessonProgressRepository,
    ProgressService,
    EnrollmentService,
    LessonService,
    ProfileService,
    CompletionListener,
  ],
  exports: [LessonProgressRepository],
})
export class LearningModule {}
