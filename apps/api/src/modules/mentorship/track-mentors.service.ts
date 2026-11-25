import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { AdminMentorsView, PersonRef } from '@hub/shared';
import { DomainError } from '../../common/errors';
import { Clock } from '../../infrastructure/clock';
import { newId } from '../../infrastructure/ids';
import { isUniqueViolation } from '../../infrastructure/prisma/errors';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MentorshipEvents, type TrackMentorEvent } from './mentorship.events';
import { assertCanMentorTrack, toAdminMentorRows } from './track-mentor-rules';

const PERSON = { id: true, githubLogin: true, displayName: true, avatarUrl: true } as const;

/** Who counts as a mentor today: active, not deleted, still holding the mentor role. */
const CURRENT_MENTOR = {
  status: 'active',
  deletedAt: null,
  roles: { some: { role: { code: 'mentor' } } },
};

/**
 * "Mentor phụ trách track" (learning-hub#120, table `track_mentors`). Admins assign and
 * remove mentors; members read who looks after a track. A mentor who loses the role or is
 * suspended keeps their open rows but disappears from both lists (CURRENT_MENTOR), so
 * giving the role back restores their tracks.
 */
@Injectable()
export class TrackMentorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly events: EventEmitter2,
  ) {}

  /** /admin/mentors: every current mentor, their tracks and mentee count. */
  async adminView(): Promise<AdminMentorsView> {
    const [mentors, tracks] = await Promise.all([
      this.prisma.user.findMany({ where: CURRENT_MENTOR, select: PERSON }),
      this.prisma.track.findMany({
        where: { status: 'active' },
        orderBy: { position: 'asc' },
        select: { slug: true, title: true },
      }),
    ]);
    const ids = mentors.map((m) => m.id);
    const [open, mentees] = await Promise.all([
      this.prisma.trackMentor.findMany({
        where: { endedAt: null, mentorId: { in: ids }, track: { status: 'active' } },
        select: {
          mentorId: true,
          startedAt: true,
          track: { select: { slug: true, title: true, position: true } },
        },
      }),
      this.prisma.mentorAssignment.groupBy({
        by: ['mentorId'],
        where: { status: 'active', mentorId: { in: ids } },
        _count: { _all: true },
      }),
    ]);
    const menteeCounts = new Map<string, number>();
    for (const row of mentees) {
      if (row.mentorId) menteeCounts.set(row.mentorId, row._count._all);
    }
    return { mentors: toAdminMentorRows(mentors, open, menteeCounts), tracks };
  }

  /** Mentors in charge of an active track, longest-serving first (track page). */
  async forTrack(slug: string): Promise<PersonRef[]> {
    const rows = await this.prisma.trackMentor.findMany({
      where: { endedAt: null, track: { slug, status: 'active' }, mentor: CURRENT_MENTOR },
      orderBy: { startedAt: 'asc' },
      select: { mentor: { select: PERSON } },
    });
    return rows.map((r) => r.mentor);
  }

  async assign(actorId: string, mentorId: string, trackSlug: string): Promise<void> {
    const track = await this.prisma.track.findFirst({
      where: { slug: trackSlug, status: 'active' },
      select: { id: true },
    });
    if (!track) throw DomainError.notFound('Track');
    const user = await this.prisma.user.findUnique({
      where: { id: mentorId },
      select: {
        githubLogin: true,
        status: true,
        deletedAt: true,
        roles: { select: { role: true } },
      },
    });
    if (!user) throw DomainError.notFound('Mentor');
    assertCanMentorTrack({ ...user, roles: user.roles.map((r) => r.role.code) });

    const id = newId();
    try {
      await this.prisma.trackMentor.create({
        data: { id, trackId: track.id, mentorId, assignedBy: actorId, startedAt: this.clock.now() },
      });
    } catch (err) {
      // track_mentors_one_open_uq: already in charge, or a second admin clicked at once.
      if (isUniqueViolation(err)) {
        throw DomainError.conflict('Mentor này đã phụ trách track này rồi.');
      }
      throw err;
    }
    this.emit(MentorshipEvents.TrackMentorAssigned, {
      actorId,
      mentorId,
      mentorLogin: user.githubLogin,
      trackSlug,
      assignmentId: id,
    });
  }

  /** Ends the open assignment; the row stays as history. Works on archived tracks too. */
  async end(actorId: string, mentorId: string, trackSlug: string): Promise<void> {
    const open = await this.prisma.trackMentor.findFirst({
      where: { mentorId, endedAt: null, track: { slug: trackSlug } },
      select: { id: true, mentor: { select: { githubLogin: true } } },
    });
    if (!open) throw DomainError.notFound('Track mentor');
    const { count } = await this.prisma.trackMentor.updateMany({
      where: { id: open.id, endedAt: null },
      data: { endedAt: this.clock.now(), endedBy: actorId },
    });
    // Another admin removed it between the read and the update: same result, one event.
    if (!count) return;
    this.emit(MentorshipEvents.TrackMentorEnded, {
      actorId,
      mentorId,
      mentorLogin: open.mentor.githubLogin,
      trackSlug,
      assignmentId: open.id,
    });
  }

  private emit(name: string, event: TrackMentorEvent): void {
    this.events.emit(name, event);
  }
}
