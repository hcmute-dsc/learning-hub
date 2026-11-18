import { Injectable } from '@nestjs/common';
import { MENTEE_INACTIVE_DAYS, type PersonRef } from '@hub/shared';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PeopleReader } from '../users/people.reader';
import { countInactiveMentees, latestActivity } from './review-rules';
import { unknownPerson } from './review-view';

/**
 * A mentor's active mentees (`mentor_assignments`, E8) and how many have gone quiet, for
 * the review queue's filter and numbers. Read-only. When the mentorship module (#7)
 * lands, this reader can move there; the queue only needs `forMentor`.
 */
@Injectable()
export class MenteeActivity {
  constructor(
    private readonly prisma: PrismaService,
    private readonly people: PeopleReader,
  ) {}

  /**
   * The mentor's active mentees (by display name) and how many are inactive.
   * `inactive` is null when the mentor has no active mentees.
   */
  async forMentor(
    mentorId: string,
    now: Date,
  ): Promise<{ mentees: PersonRef[]; inactive: number | null }> {
    const assignments = await this.prisma.mentorAssignment.findMany({
      where: { mentorId, status: 'active' },
      select: { menteeId: true, startedAt: true },
    });
    if (!assignments.length) return { mentees: [], inactive: null };

    const ids = [...new Set(assignments.map((a) => a.menteeId))];
    const [people, submissions, progress] = await Promise.all([
      this.people.byIds(ids),
      this.prisma.submission.groupBy({
        by: ['userId'],
        where: { userId: { in: ids } },
        _max: { submittedAt: true },
      }),
      this.prisma.lessonProgress.groupBy({
        by: ['userId'],
        where: { userId: { in: ids } },
        _max: { updatedAt: true },
      }),
    ]);
    const last = latestActivity(
      submissions.map((r) => ({ userId: r.userId, at: r._max.submittedAt })),
      progress.map((r) => ({ userId: r.userId, at: r._max.updatedAt })),
    );
    const mentees = ids
      .map((id) => people.get(id) ?? unknownPerson(id))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'vi'));
    return {
      mentees,
      inactive: countInactiveMentees(assignments, last, now, MENTEE_INACTIVE_DAYS),
    };
  }
}
