import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { LearningModule } from '../learning/learning.module';
import { SubmissionsModule } from '../submissions/submissions.module';
import { UsersModule } from '../users/users.module';
import { MenteeActivity } from './mentee-activity';
import { ReviewRecordsModule } from './review-records.module';
import { ReviewThreadController } from './review-thread.controller';
import { ReviewThreadService } from './review-thread.service';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

/**
 * E7: mentor review. Owns the `reviews` table. Depends on submissions (queue, outcome),
 * catalog (track list), learning (lesson-progress dates) and users (names); nothing depends on it except through the COMPLETED_REVIEWS port.
 *
 * Files, by job:
 *   review-rules.ts          who may claim/release/complete, rubric scores, waiting time (pure)
 *   review-view.ts           database rows → API contract (pure; drafts never reach members)
 *   review-records.ts        reads `reviews` for many submissions at once
 *   review-records.module.ts binds the submissions module's COMPLETED_REVIEWS port
 *   mentee-activity.ts       a mentor's active mentees and who went quiet (E8 data, read-only)
 *   review-thread-*.ts       the member–mentor conversation and thank-you note (learning-hub#41)
 *   reviews.events.ts        Claimed / Released / Completed / MessagePosted / ThanksSent
 */
@Module({
  imports: [SubmissionsModule, CatalogModule, LearningModule, UsersModule, ReviewRecordsModule],
  controllers: [ReviewsController, ReviewThreadController],
  providers: [ReviewsService, ReviewThreadService, MenteeActivity],
})
export class ReviewsModule {}
