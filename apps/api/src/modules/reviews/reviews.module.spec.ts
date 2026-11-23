import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { ENV } from '../../infrastructure/config/env';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { LearningModule } from '../learning/learning.module';
import { SubmissionsService } from '../submissions/submissions.service';
import { SubmissionsModule } from '../submissions/submissions.module';
import { ReviewsModule } from './reviews.module';
import { ReviewRecords } from './review-records';
import { ReviewThreadService } from './review-thread.service';
import { ReviewsService } from './reviews.service';

/**
 * Wiring check without a database: the COMPLETED_REVIEWS port that SubmissionsModule
 * needs is bound by the global ReviewRecordsModule, with no import cycle between the
 * submissions and reviews modules.
 */
describe('ReviewsModule wiring', () => {
  it('resolves the services and binds the completed-reviews port', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        EventEmitterModule.forRoot(),
        InfrastructureModule,
        SubmissionsModule,
        LearningModule,
        ReviewsModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(ENV)
      .useValue({ REVIEW_TARGET_HOURS: 72 })
      .compile();

    expect(moduleRef.get(ReviewsService)).toBeInstanceOf(ReviewsService);
    expect(moduleRef.get(ReviewThreadService)).toBeInstanceOf(ReviewThreadService);
    const submissions = moduleRef.get(SubmissionsService) as unknown as { reviews: unknown };
    expect(submissions.reviews).toBe(moduleRef.get(ReviewRecords));
  });
});
