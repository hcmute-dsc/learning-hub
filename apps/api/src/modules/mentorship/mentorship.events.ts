/** Domain events of the mentorship module (BACKEND-DESIGN §5). Audit listens to them. */
export const MentorshipEvents = {
  TrackMentorAssigned: 'mentorship.track_mentor_assigned',
  TrackMentorEnded: 'mentorship.track_mentor_ended',
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
