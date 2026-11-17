import { Global, Module } from '@nestjs/common';
import { COMPLETED_REVIEWS } from '../submissions/ports/completed-reviews';
import { UsersModule } from '../users/users.module';
import { ReviewRecords } from './review-records';

/**
 * Binds the submissions module's COMPLETED_REVIEWS port to ReviewRecords.
 *
 * Why a separate, global module: reviews depends on submissions (ReviewsModule imports
 * SubmissionsModule), so submissions cannot import ReviewsModule back. Global makes the
 * port visible to SubmissionsModule without that cycle, the same way integrations bind
 * ports (integrations/content-source.module.ts). It only needs Prisma and users.
 */
@Global()
@Module({
  imports: [UsersModule],
  providers: [ReviewRecords, { provide: COMPLETED_REVIEWS, useExisting: ReviewRecords }],
  exports: [ReviewRecords, COMPLETED_REVIEWS],
})
export class ReviewRecordsModule {}
