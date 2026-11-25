import { Module } from '@nestjs/common';
import { AdminMentorsController, TrackMentorsController } from './track-mentors.controller';
import { TrackMentorsService } from './track-mentors.service';

/**
 * Mentorship (E8, learning-hub#120): which mentors look after which track (`track_mentors`).
 * Mentee assignments (`mentor_assignments`) come next in the same module. Audit entries
 * come from MentorshipEvents.
 */
@Module({
  controllers: [AdminMentorsController, TrackMentorsController],
  providers: [TrackMentorsService],
})
export class MentorshipModule {}
