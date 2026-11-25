import { z } from 'zod';
import { TRACK_SLUG_PATTERN, type PersonRef } from './review';

/**
 * Mentors in charge of a track (learning-hub#120, DATABASE §3.15b). An admin assigns them
 * on /admin/mentors; the track page lists them so members know who looks after it.
 */

export const assignTrackMentorSchema = z.object({
  trackSlug: z.string().max(80).regex(TRACK_SLUG_PATTERN),
});
export type AssignTrackMentorInput = z.infer<typeof assignTrackMentorSchema>;

/** A track one mentor is in charge of, and since when (ISO date-time). */
export interface MentorTrackRef {
  slug: string;
  title: string;
  since: string;
}

/** One row of /admin/mentors: an active account with the mentor role. */
export interface AdminMentorRow {
  mentor: PersonRef;
  tracks: MentorTrackRef[];
  /** mentees assigned to this mentor right now (`mentor_assignments.status = 'active'`) */
  activeMentees: number;
}

export interface AdminMentorsView {
  mentors: AdminMentorRow[];
  /** active tracks, in catalog order, for the "add a track" picker */
  tracks: { slug: string; title: string }[];
}
