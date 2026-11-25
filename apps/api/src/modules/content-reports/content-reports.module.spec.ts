import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { REQUIRED_ROLES } from '../../common/auth.decorators';
import { ENV } from '../../infrastructure/config/env';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ContentReportsController } from './content-reports.controller';
import { ContentReportsModule } from './content-reports.module';
import { ContentReportsService } from './content-reports.service';
import { DisabledIssueTracker, ISSUE_TRACKER } from './ports/issue-tracker';

describe('ContentReportsModule', () => {
  it('resolves without a database, and without a GitHub token the button is off', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot(), InfrastructureModule, ContentReportsModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(ENV)
      .useValue({})
      .compile();

    expect(moduleRef.get(ContentReportsService)).toBeInstanceOf(ContentReportsService);
    const tracker = moduleRef.get(ISSUE_TRACKER);
    expect(tracker).toBeInstanceOf(DisabledIssueTracker);
    await expect(tracker.createIssue('o/r', { title: 't', body: 'b' })).rejects.toMatchObject({
      status: 503,
    });
  });

  it('lets any signed-in member report, and only mentors (and admins) handle reports', () => {
    const roles = (method: keyof ContentReportsController) =>
      Reflect.getMetadata(REQUIRED_ROLES, ContentReportsController.prototype[method]);
    expect(roles('create')).toBeUndefined();
    expect(Reflect.getMetadata(REQUIRED_ROLES, ContentReportsController)).toBeUndefined();
    for (const method of ['list', 'counts', 'update', 'createIssue'] as const) {
      expect(roles(method)).toEqual(['mentor']);
    }
  });
});
