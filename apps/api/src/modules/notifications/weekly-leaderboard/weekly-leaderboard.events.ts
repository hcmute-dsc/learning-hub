/** Admin actions on the weekly leaderboard post (learning-hub#83), written to audit_logs. */
export const LeaderboardPostEvents = {
  Posted: 'leaderboard_post.posted',
  Updated: 'leaderboard_post.updated',
} as const;

export interface LeaderboardPostEvent {
  actorId: string;
  /** ISO week, e.g. "2026-W47" */
  weekId: string;
  /** members shown in the post */
  members: number;
}
