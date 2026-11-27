import type { MentorChoice, MenteeRow, PersonRef } from '@hub/shared';
import { DomainError } from '../../common/errors';

/**
 * Rules for "gán mentor cho mentee" (US-11, learning-hub#120, DATABASE §3.15 and §5.6).
 * Pure functions, tested in mentee-mentor-rules.spec.ts.
 */

/** The open `mentor_assignments` row of one mentee in one track, if any. */
export interface OpenAssignment {
  id: string;
  /** requested (the member asked, #7) | active */
  status: string;
  mentorId: string | null;
}

/**
 * What to do with the mentee's open row when the admin picks `mentorId` (null = none):
 * - `none`: nothing changes (same mentor already, or no mentor and nothing open);
 * - `activate`: a request (#7) gets this mentor and becomes active;
 * - `end`: the current assignment ends (kept as history);
 * - `replace`: the current one ends and a new active row starts;
 * - `create`: a new active row.
 */
export type AssignmentPlan = 'none' | 'activate' | 'end' | 'replace' | 'create';

export function planAssignment(
  open: OpenAssignment | null,
  mentorId: string | null,
): AssignmentPlan {
  if (!open) return mentorId ? 'create' : 'none';
  if (mentorId === null) return 'end';
  if (open.status === 'requested') return 'activate';
  return open.mentorId === mentorId ? 'none' : 'replace';
}

/** A member is never their own mentor (also a CHECK in the database). */
export function assertNotSelf(menteeId: string, mentorId: string): void {
  if (menteeId === mentorId) {
    throw DomainError.conflict('Không thể tự làm mentor của chính mình.');
  }
}

/** Only members enrolled in the track (not dropped) get a mentor for it. */
export function assertEnrolled(enrollment: { status: string } | null): void {
  if (!enrollment || enrollment.status === 'dropped') {
    throw DomainError.conflict('Thành viên này chưa ghi danh track này.');
  }
}

/** MENTOR_MAX_MENTEES counts active mentees across all tracks (PRD US-11). */
export function assertHasRoom(activeMentees: number, maxMentees: number): void {
  if (activeMentees >= maxMentees) {
    throw DomainError.conflict(
      `Mentor này đã kèm đủ ${maxMentees} mentee. Chọn mentor khác hoặc bỏ bớt mentee của họ.`,
    );
  }
}

/** Mentors of this track first, then by name. */
export function toMentorChoices(
  mentors: PersonRef[],
  trackMentorIds: Set<string>,
  activeMentees: Map<string, number>,
): MentorChoice[] {
  return mentors
    .map((mentor) => ({
      mentor,
      activeMentees: activeMentees.get(mentor.id) ?? 0,
      inTrack: trackMentorIds.has(mentor.id),
    }))
    .sort(
      (a, b) =>
        Number(b.inTrack) - Number(a.inTrack) ||
        a.mentor.displayName.localeCompare(b.mentor.displayName, 'vi'),
    );
}

/** Enrolled members by name, each with their active mentor in this track. */
export function toMenteeRows(
  members: PersonRef[],
  active: { menteeId: string; mentor: PersonRef | null; startedAt: Date | null }[],
): MenteeRow[] {
  const byMentee = new Map(active.map((a) => [a.menteeId, a]));
  return [...members]
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'vi'))
    .map((member) => {
      const row = byMentee.get(member.id);
      return {
        member,
        mentor: row?.mentor ?? null,
        since: row?.mentor && row.startedAt ? row.startedAt.toISOString() : null,
      };
    });
}
