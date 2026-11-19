import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { ENV } from '../../infrastructure/config/env';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ReviewsModule } from '../reviews/reviews.module';
import { CertificatesListener } from './certificates.listener';
import { CertificatesModule } from './certificates.module';
import { CertificatesService } from './certificates.service';

/** Wiring check without a database: learning exports what certificates need, no cycle. */
describe('CertificatesModule wiring', () => {
  it('resolves the service and the listener', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        EventEmitterModule.forRoot(),
        InfrastructureModule,
        CertificatesModule,
        // binds the COMPLETED_REVIEWS port that learning → submissions needs (as in the app)
        ReviewsModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(ENV)
      .useValue({ REVIEW_TARGET_HOURS: 72 })
      .compile();

    expect(moduleRef.get(CertificatesService)).toBeInstanceOf(CertificatesService);
    expect(moduleRef.get(CertificatesListener)).toBeInstanceOf(CertificatesListener);
  });
});
