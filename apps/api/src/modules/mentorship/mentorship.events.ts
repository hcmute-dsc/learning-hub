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
 * `mentorId: null` = removed. Names and logins are carried so audit and the bell (#131)
 * never read `users`.
 */
export interface MenteeMentorChangedEvent {
  actorId: string;
  /** the new active row, or the ended one when the mentor was removed */
  assignmentId: string;
  menteeId: string;
  menteeLogin: string;
  menteeName: string;
  trackSlug: string;
  trackTitle: string;
  mentorId: string | null;
  mentorLogin: string | null;
  mentorName: string | null;
  /** the mentor before this change (null when there was none) */
  previousMentorId: string | null;
  previousMentorLogin: string | null;
  previousMentorName: string | null;
}
