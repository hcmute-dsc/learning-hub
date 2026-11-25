import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import type { Role } from '@hub/shared';
import { REQUIRED_ROLES } from '../../common/auth.decorators';
import { ENV } from '../../infrastructure/config/env';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { checkAccess } from '../identity/auth.guard';
import { ReportsController } from './reports.controller';
import { ReportsModule } from './reports.module';
import { ReportsService } from './reports.service';
import { TrackStatsController } from './track-stats.controller';
import { TrackStatsService } from './track-stats.service';

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
    expect(moduleRef.get(TrackStatsService)).toBeInstanceOf(TrackStatsService);
  });

  it('is for admins only (member emails stay out, but logins and progress are still personal)', () => {
    expect(Reflect.getMetadata(REQUIRED_ROLES, ReportsController)).toEqual(['admin']);
  });

  it('opens track statistics to mentors and admins, never to members', () => {
    const roles = Reflect.getMetadata(REQUIRED_ROLES, TrackStatsController) as Role[];
    expect(roles).toEqual(['mentor']);
    const as = (...r: Role[]) => ({
      id: 'u',
      githubLogin: 'u',
      status: 'active' as const,
      roles: r,
    });
    const opts = { isPublic: false, allowPending: false, roles };
    // Which tracks a mentor may see is checked in TrackStatsService (track-stats.service.spec.ts).
    expect(() => checkAccess(as('member', 'mentor'), opts)).not.toThrow();
    expect(() => checkAccess(as('member', 'admin'), opts)).not.toThrow();
    expect(() => checkAccess(as('member'), opts)).toThrow(expect.objectContaining({ status: 403 }));
    expect(() => checkAccess(null, opts)).toThrow(expect.objectContaining({ status: 401 }));
  });
});
