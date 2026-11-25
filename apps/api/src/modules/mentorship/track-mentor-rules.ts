import type { AdminMentorRow, PersonRef } from '@hub/shared';
import { DomainError } from '../../common/errors';

/**
 * Rules for "mentor phụ trách track" (learning-hub#120). Pure functions, tested in
 * track-mentor-rules.spec.ts; the service only loads rows and calls these.
 */

/** The account an admin wants to put in charge of a track. */
export interface MentorCandidate {
  status: string;
  deletedAt: Date | null;
  roles: string[];
}

/**
 * Only an active account with the mentor role can look after a track. Admin alone is not
 * enough: an admin who also mentors gets the mentor role on "Thành viên" first, so the
 * mentor list stays the list of people who actually mentor.
 */
export function assertCanMentorTrack(candidate: MentorCandidate | null): void {
  if (!candidate || candidate.deletedAt) throw DomainError.notFound('Mentor');
  if (candidate.status !== 'active') {
    throw DomainError.conflict('Tài khoản này đang không hoạt động, không gán làm mentor được.');
  }
  if (!candidate.roles.includes('mentor')) {
    throw DomainError.conflict(
      'Tài khoản này chưa có vai trò mentor. Cấp vai trò ở trang Thành viên trước.',
    );
  }
}

/** One open `track_mentors` row with what the page needs from its track. */
export interface OpenTrackMentor {
  mentorId: string;
  startedAt: Date;
  track: { slug: string; title: string; position: number };
}

/**
 * Rows of /admin/mentors: every mentor (even with no track yet, so the admin sees who is
 * free), by name; their tracks in catalog order; mentees counted per mentor.
 */
export function toAdminMentorRows(
  mentors: PersonRef[],
  open: OpenTrackMentor[],
  activeMentees: Map<string, number>,
): AdminMentorRow[] {
  return [...mentors]
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'vi'))
    .map((mentor) => ({
      mentor,
      tracks: open
        .filter((row) => row.mentorId === mentor.id)
        .sort((a, b) => a.track.position - b.track.position)
        .map((row) => ({
          slug: row.track.slug,
          title: row.track.title,
          since: row.startedAt.toISOString(),
        })),
      activeMentees: activeMentees.get(mentor.id) ?? 0,
    }));
}
