import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  TRACK_SLUG_PATTERN,
  assignTrackMentorSchema,
  menteeAssignmentsQuerySchema,
  setMenteeMentorSchema,
  type AssignTrackMentorInput,
  type SetMenteeMentorInput,
} from '@hub/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser, Roles } from '../../common/auth.decorators';
import { ZodPipe } from '../../common/zod';
import { MenteeMentorsService } from './mentee-mentors.service';
import { TrackMentorsService } from './track-mentors.service';

const idPipe = new ZodPipe(z.string().uuid());
const slugPipe = new ZodPipe(z.string().max(80).regex(TRACK_SLUG_PATTERN));

/** "Mentor" tab of the admin area (learning-hub#120): admin only. */
@ApiTags('admin')
@Roles('admin')
@Controller('admin/mentors')
export class AdminMentorsController {
  constructor(
    private readonly mentors: TrackMentorsService,
    private readonly menteeMentors: MenteeMentorsService,
  ) {}

  @Get()
  list() {
    return this.mentors.adminView().then((data) => ({ data }));
  }

  /** Members of one track and their mentor (US-11). */
  @Get('mentees')
  listMentees(@Query(new ZodPipe(menteeAssignmentsQuerySchema)) query: { track: string }) {
    return this.menteeMentors.view(query.track).then((data) => ({ data }));
  }

  /** Gives, changes or removes (`mentorId: null`) a mentee's mentor in one track. */
  @Put('mentees/:menteeId')
  @HttpCode(204)
  setMenteeMentor(
    @CurrentUser() actor: AuthUser,
    @Param('menteeId', idPipe) menteeId: string,
    @Body(new ZodPipe(setMenteeMentorSchema)) body: SetMenteeMentorInput,
  ) {
    return this.menteeMentors.set(actor.id, menteeId, body.trackSlug, body.mentorId);
  }

  @Post(':mentorId/tracks')
  @HttpCode(204)
  assign(
    @CurrentUser() actor: AuthUser,
    @Param('mentorId', idPipe) mentorId: string,
    @Body(new ZodPipe(assignTrackMentorSchema)) body: AssignTrackMentorInput,
  ) {
    return this.mentors.assign(actor.id, mentorId, body.trackSlug);
  }

  @Delete(':mentorId/tracks/:slug')
  @HttpCode(204)
  end(
    @CurrentUser() actor: AuthUser,
    @Param('mentorId', idPipe) mentorId: string,
    @Param('slug', slugPipe) slug: string,
  ) {
    return this.mentors.end(actor.id, mentorId, slug);
  }
}

/** Mentors in charge of a track, for the track page: any signed-in member. */
@ApiTags('catalog')
@Controller('tracks/:slug/mentors')
export class TrackMentorsController {
  constructor(private readonly mentors: TrackMentorsService) {}

  @Get()
  list(@Param('slug', slugPipe) slug: string) {
    return this.mentors.forTrack(slug).then((data) => ({ data }));
  }
}
