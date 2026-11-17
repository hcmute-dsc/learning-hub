import { Module } from '@nestjs/common';
import { SubmissionsModule } from '../submissions/submissions.module';
import { UsersModule } from '../users/users.module';
import { ReviewRecordsModule } from './review-records.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

/**
 * E7: mentor review. Owns the `reviews` table. Depends on submissions (queue, outcome)
 * and users (names); nothing depends on it except through the COMPLETED_REVIEWS port.
 *
 * Files, by job:
 *   review-rules.ts          who may claim/release/complete, rubric scores, waiting time (pure)
 *   review-view.ts           database rows → API contract (pure; drafts never reach members)
 *   review-records.ts        reads `reviews` for many submissions at once
 *   review-records.module.ts binds the submissions module's COMPLETED_REVIEWS port
 *   reviews.events.ts        Claimed / Released / Completed (audit and notifications listen)
 */
@Module({
  imports: [SubmissionsModule, UsersModule, ReviewRecordsModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
