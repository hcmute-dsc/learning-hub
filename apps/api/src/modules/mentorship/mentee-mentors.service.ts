import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { MenteeAssignmentsView } from '@hub/shared';
import { DomainError } from '../../common/errors';
import { Clock } from '../../infrastructure/clock';
import { ENV, type Env } from '../../infrastructure/config/env';
import { newId } from '../../infrastructure/ids';
import { isUniqueViolation } from '../../infrastructure/prisma/errors';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  assertEnrolled,
  assertHasRoom,
  assertNotSelf,
  planAssignment,
  toMenteeRows,
  toMentorChoices,
} from './mentee-mentor-rules';
import { CURRENT_MENTOR, PERSON } from './mentor-queries';
import { MentorshipEvents, type MenteeMentorChangedEvent } from './mentorship.events';
import { assertCanMentorTrack } from './track-mentor-rules';

const OPEN = ['requested', 'active'];

/**
 * "Gán mentor cho mentee" (US-11, learning-hub#120, table `mentor_assignments`). An admin
 * picks, changes or removes the mentor of each member enrolled in a track. Old rows are
 * ended, never deleted. A request a member made (#7, `requested`) is fulfilled in place.
 * The review queue's "mentee của tôi" filter reads the active rows (MenteeActivity).
 */
@Injectable()
export class MenteeMentorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly events: EventEmitter2,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Members of one active track with their mentor, and the mentors to pick from. */
  async view(trackSlug: string): Promise<MenteeAssignmentsView> {
    const track = await this.activeTrack(trackSlug);
    const [mentors, trackMentors, enrolled, active, counts] = await Promise.all([
      this.prisma.user.findMany({ where: CURRENT_MENTOR, select: PERSON }),
      this.prisma.trackMentor.findMany({
        where: { trackId: track.id, endedAt: null },
        select: { mentorId: true },
      }),
      this.prisma.enrollment.findMany({
        where: {
          trackId: track.id,
          status: { not: 'dropped' },
          user: { status: 'active', deletedAt: null },
        },
        select: { user: { select: PERSON } },
      }),
      this.prisma.mentorAssignment.findMany({
        where: { trackId: track.id, status: 'active' },
        select: { menteeId: true, startedAt: true, mentor: { select: PERSON } },
      }),
      this.prisma.mentorAssignment.groupBy({
        by: ['mentorId'],
        where: { status: 'active' },
        _count: { _all: true },
      }),
    ]);
    const activeCounts = new Map<string, number>();
    for (const row of counts) if (row.mentorId) activeCounts.set(row.mentorId, row._count._all);

    return {
      track: { slug: track.slug, title: track.title },
      maxMentees: this.env.MENTOR_MAX_MENTEES,
      mentors: toMentorChoices(mentors, new Set(trackMentors.map((t) => t.mentorId)), activeCounts),
      members: toMenteeRows(
        enrolled.map((e) => e.user),
        active,
      ),
    };
  }

  /** Gives the mentee `mentorId` in this track; null removes their mentor. */
  async set(
    actorId: string,
    menteeId: string,
    trackSlug: string,
    mentorId: string | null,
  ): Promise<void> {
    const track = await this.activeTrack(trackSlug);
    const mentee = await this.prisma.user.findUnique({
      where: { id: menteeId },
      select: { githubLogin: true, displayName: true, deletedAt: true },
    });
    if (!mentee || mentee.deletedAt) throw DomainError.notFound('Member');

    let mentorLogin: string | null = null;
    let mentorName: string | null = null;
    if (mentorId) {
      assertNotSelf(menteeId, mentorId);
      const mentor = await this.prisma.user.findUnique({
        where: { id: mentorId },
        select: {
          githubLogin: true,
          displayName: true,
          status: true,
          deletedAt: true,
          roles: { select: { role: true } },
        },
      });
      if (!mentor) throw DomainError.notFound('Mentor');
      assertCanMentorTrack({ ...mentor, roles: mentor.roles.map((r) => r.role.code) });
      mentorLogin = mentor.githubLogin;
      mentorName = mentor.displayName;
      assertEnrolled(
        await this.prisma.enrollment.findUnique({
          where: { userId_trackId: { userId: menteeId, trackId: track.id } },
          select: { status: true },
        }),
      );
    }

    const now = this.clock.now();
    const done = await this.prisma
      .$transaction(async (tx) => {
        // The mentor's room is counted and used inside one lock, so two admins cannot
        // both give the last place. Every transaction takes at most one mentor lock and
        // then the mentee lock, always in that order, so they cannot deadlock.
        if (mentorId) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`mentor-room:${mentorId}`}, 0))`;
        }
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`mentee:${menteeId}:${track.id}`}, 0))`;

        const open = await tx.mentorAssignment.findFirst({
          where: { menteeId, trackId: track.id, status: { in: OPEN } },
          select: {
            id: true,
            status: true,
            mentorId: true,
            mentor: { select: { id: true, githubLogin: true, displayName: true } },
          },
        });
        const plan = planAssignment(open, mentorId);
        if (plan === 'none') return null;
        if (mentorId) {
          assertHasRoom(
            await tx.mentorAssignment.count({ where: { mentorId, status: 'active' } }),
            this.env.MENTOR_MAX_MENTEES,
          );
        }
        // only a running assignment had a mentor; a request (#7) had none yet
        const previousMentor = open?.status === 'active' ? (open.mentor ?? null) : null;

        if (open && plan === 'activate') {
          await tx.mentorAssignment.update({
            where: { id: open.id },
            data: { status: 'active', mentorId, decidedBy: actorId, startedAt: now },
          });
          return { assignmentId: open.id, previousMentor };
        }
        if (open && (plan === 'end' || plan === 'replace')) {
          await tx.mentorAssignment.update({
            where: { id: open.id },
            data: {
              // a request nobody took is declined; a running assignment is ended
              status: open.status === 'requested' ? 'declined' : 'ended',
              decidedBy: open.status === 'requested' ? actorId : undefined,
              endedAt: now,
            },
          });
          if (plan === 'end') return { assignmentId: open.id, previousMentor };
        }
        const id = newId();
        await tx.mentorAssignment.create({
          data: {
            id,
            menteeId,
            mentorId,
            trackId: track.id,
            status: 'active',
            decidedBy: actorId,
            startedAt: now,
          },
        });
        return { assignmentId: id, previousMentor };
      })
      .catch((err: unknown) => {
        // mentor_assignments_one_open_uq; the mentee lock should make this unreachable
        if (isUniqueViolation(err)) {
          throw DomainError.conflict('Mentee này vừa được người khác đổi mentor. Tải lại trang.');
        }
        throw err;
      });
    if (!done) return;

    const event: MenteeMentorChangedEvent = {
      actorId,
      assignmentId: done.assignmentId,
      menteeId,
      menteeLogin: mentee.githubLogin,
      menteeName: mentee.displayName,
      trackSlug,
      trackTitle: track.title,
      mentorId,
      mentorLogin,
      mentorName,
      previousMentorId: done.previousMentor?.id ?? null,
      previousMentorLogin: done.previousMentor?.githubLogin ?? null,
      previousMentorName: done.previousMentor?.displayName ?? null,
    };
    this.events.emit(MentorshipEvents.MenteeMentorChanged, event);
  }

  private async activeTrack(slug: string) {
    const track = await this.prisma.track.findFirst({
      where: { slug, status: 'active' },
      select: { id: true, slug: true, title: true },
    });
    if (!track) throw DomainError.notFound('Track');
    return track;
  }
}
