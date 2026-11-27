/** Domain events of the mentorship module (BACKEND-DESIGN §5). Audit listens to them. */
export const MentorshipEvents = {
  TrackMentorAssigned: 'mentorship.track_mentor_assigned',
  TrackMentorEnded: 'mentorship.track_mentor_ended',
  MenteeMentorChanged: 'mentorship.mentee_mentor_changed',
} as const;

/** An admin put a mentor in charge of a track, or took them off it (learning-hub#120). */
export interface TrackMentorEvent {
  actorId: string;
  mentorId: string;
  /** shown on /admin/audit; the audit module never reads `users` itself */
  mentorLogin: string;
  trackSlug: string;
  /** the `track_mentors` row */
  assignmentId: string;
}

/**
 * An admin gave a mentee a mentor in one track, changed it, or removed it (US-11).
 * `mentorId: null` = removed. Logins are carried so audit never reads `users`.
 */
export interface MenteeMentorChangedEvent {
  actorId: string;
  /** the new active row, or the ended one when the mentor was removed */
  assignmentId: string;
  menteeId: string;
  menteeLogin: string;
  trackSlug: string;
  mentorId: string | null;
  mentorLogin: string | null;
  previousMentorLogin: string | null;
}
