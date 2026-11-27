import { Module } from '@nestjs/common';
import { AdminMentorsController, TrackMentorsController } from './track-mentors.controller';
import { MenteeMentorsService } from './mentee-mentors.service';
import { TrackMentorsService } from './track-mentors.service';

/**
 * Mentorship (E8, learning-hub#120): which mentors look after which track (`track_mentors`)
 * and which mentor each member has in a track (`mentor_assignments`, US-11). Audit entries
 * come from MentorshipEvents.
 */
@Module({
  controllers: [AdminMentorsController, TrackMentorsController],
  providers: [TrackMentorsService, MenteeMentorsService],
})
export class MentorshipModule {}
