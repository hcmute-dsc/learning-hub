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

// ---------- Mentee assignments (US-11, `mentor_assignments`) ----------

export const menteeAssignmentsQuerySchema = z.object({
  track: z.string().max(80).regex(TRACK_SLUG_PATTERN),
});

/** PUT /admin/mentors/mentees/:menteeId — `mentorId: null` ends the current assignment. */
export const setMenteeMentorSchema = z.object({
  trackSlug: z.string().max(80).regex(TRACK_SLUG_PATTERN),
  mentorId: z.string().uuid().nullable(),
});
export type SetMenteeMentorInput = z.infer<typeof setMenteeMentorSchema>;

/** A mentor the admin can pick for a mentee of one track. */
export interface MentorChoice {
  mentor: PersonRef;
  /** active mentees in every track; at `maxMentees` the mentor takes no new mentee */
  activeMentees: number;
  /** in charge of this track (`track_mentors`), listed first */
  inTrack: boolean;
}

/** One member enrolled in the track and their mentor there, if any. */
export interface MenteeRow {
  member: PersonRef;
  mentor: PersonRef | null;
  /** when the current assignment started (ISO), null without a mentor */
  since: string | null;
}

export interface MenteeAssignmentsView {
  track: { slug: string; title: string };
  /** MENTOR_MAX_MENTEES, set per term (BACKEND-DESIGN) */
  maxMentees: number;
  mentors: MentorChoice[];
  members: MenteeRow[];
}
