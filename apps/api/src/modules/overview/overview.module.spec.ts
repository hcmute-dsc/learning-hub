import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { ENV } from '../../infrastructure/config/env';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ReviewRecordsModule } from '../reviews/review-records.module';
import { OverviewModule } from './overview.module';
import { OverviewService } from './overview.service';

/**
 * Wiring check without a database: every service the overview asks is exported to it.
 * ReviewRecordsModule is global in the app and binds the port SubmissionsModule needs.
 */
describe('OverviewModule wiring', () => {
  it('resolves the overview service', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        EventEmitterModule.forRoot(),
        InfrastructureModule,
        ReviewRecordsModule,
        OverviewModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(ENV)
      .useValue({ REVIEW_TARGET_HOURS: 72, CONTENT_SOURCE: 'local', CONTENT_LOCAL_DIR: '.' })
      .compile();

    expect(moduleRef.get(OverviewService)).toBeInstanceOf(OverviewService);
  });
});
