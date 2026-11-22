import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { REQUIRED_ROLES } from '../../common/auth.decorators';
import { ENV } from '../../infrastructure/config/env';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ReportsController } from './reports.controller';
import { ReportsModule } from './reports.module';
import { ReportsService } from './reports.service';

describe('ReportsModule', () => {
  it('resolves without a database', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot(), InfrastructureModule, ReportsModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(ENV)
      .useValue({})
      .compile();

    expect(moduleRef.get(ReportsService)).toBeInstanceOf(ReportsService);
  });

  it('is for admins only (member emails stay out, but logins and progress are still personal)', () => {
    expect(Reflect.getMetadata(REQUIRED_ROLES, ReportsController)).toEqual(['admin']);
  });
});
