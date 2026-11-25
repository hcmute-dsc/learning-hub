import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { REQUIRED_ROLES } from '../../common/auth.decorators';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ENV } from '../../infrastructure/config/env';
import { MentorshipModule } from './mentorship.module';
import { AdminMentorsController, TrackMentorsController } from './track-mentors.controller';
import { TrackMentorsService } from './track-mentors.service';

describe('MentorshipModule', () => {
  it('resolves without a database', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot(), InfrastructureModule, MentorshipModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(ENV)
      .useValue({})
      .compile();

    expect(moduleRef.get(TrackMentorsService)).toBeInstanceOf(TrackMentorsService);
  });

  it('keeps assigning to admins, and lets any signed-in member read a track’s mentors', () => {
    expect(Reflect.getMetadata(REQUIRED_ROLES, AdminMentorsController)).toEqual(['admin']);
    expect(Reflect.getMetadata(REQUIRED_ROLES, TrackMentorsController)).toBeUndefined();
    expect(
      Reflect.getMetadata(REQUIRED_ROLES, TrackMentorsController.prototype.list),
    ).toBeUndefined();
  });
});
