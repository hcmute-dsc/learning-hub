/**
 * Outbox event types owned by the notifications module (learning-hub#49, DATABASE §3.16b).
 *
 * Why an outbox: a domain event only lives in memory. Writing a row first means a
 * notification survives an API restart and a failed delivery is retried, without the
 * member's request waiting for the fan-out or the email.
 */
export const OutboxTypes = {
  /** payload: ReviewCompletedPayload → one bell row for the member */
  ReviewCompleted: 'inbox.review_completed',
  /** payload: ReviewRequestedPayload → one bell row per mentor and admin */
  ReviewRequested: 'inbox.review_requested',
  /** payload: TrackPublishedPayload → one bell row per active member */
  TrackPublished: 'inbox.track_published',
  /** payload: ReviewThreadPayload → one bell row for the other side of the conversation (#41) */
  ReviewMessage: 'inbox.review_message',
  /** payload: ReviewThreadPayload → one bell row for the mentor (#41) */
  ReviewThanks: 'inbox.review_thanks',
  /** payload: ContentReportClosedPayload → one bell row for the reporter (#121) */
  ContentReportClosed: 'inbox.content_report_closed',
  /** payload: MentorAssignmentPayload → bell rows for the mentee and both mentors (#131) */
  MentorAssignment: 'inbox.mentor_assignment',
  /** payload: EmailDigestPayload → one email */
  EmailDigest: 'email.digest',
  /** payload: WeeklyPost (weekly-post.ts) → one embed on the club channel (learning-hub#76) */
  LeaderboardWeek: 'discord.leaderboard_week',
} as const;

export type OutboxType = (typeof OutboxTypes)[keyof typeof OutboxTypes];
export const OUTBOX_TYPES: OutboxType[] = Object.values(OutboxTypes);

export interface ReviewCompletedPayload {
  exerciseId: string;
  memberId: string;
  outcome: 'approved' | 'changes_requested';
}

export interface ReviewRequestedPayload {
  submissionId: string;
  exerciseId: string;
  /** the member who submitted: never notified about their own submission */
  memberId: string;
}

/** A message or a thank-you on a finished review (learning-hub#41). */
export interface ReviewThreadPayload {
  submissionId: string;
  exerciseId: string;
  memberId: string;
  reviewerId: string;
  /** who wrote it: never notified about their own words */
  authorId: string;
}

/** A report the member sent was resolved or dismissed (learning-hub#121). */
export interface ContentReportClosedPayload {
  reporterId: string;
  status: 'resolved' | 'dismissed';
  targetTitle: string;
  /** path inside the web app */
  targetLink: string;
}

/**
 * An admin gave a mentee a mentor in one track, changed it or removed it (#131, US-11).
 * Names are copied in because the bell text needs them and they rarely change.
 */
export interface MentorAssignmentPayload {
  /** the admin who did it: never notified about their own action */
  actorId: string;
  trackSlug: string;
  trackTitle: string;
  mentee: { id: string; login: string; name: string };
  /** null when the mentor was removed */
  mentor: { id: string; login: string; name: string } | null;
  /** null when the mentee had no mentor before */
  previousMentor: { id: string; login: string; name: string } | null;
}

export interface TrackPublishedPayload {
  slug: string;
  title: string;
}

export interface EmailDigestPayload {
  userId: string;
  /** ISO time: the digest lists unread notifications newer than this */
  since: string;
}

/** After this many failed attempts the row is marked `failed` and left for a person to read. */
export const MAX_ATTEMPTS = 8;
const FIRST_RETRY_MS = 60_000;
const MAX_RETRY_MS = 6 * 60 * 60_000;

/**
 * What to do with a row whose attempt number `attempts` just failed: retry later with
 * exponential backoff (1 min, 2, 4 … capped at 6 h), or give up.
 */
export function afterFailure(
  attempts: number,
  now: Date,
): { status: 'pending'; nextAttemptAt: Date } | { status: 'failed' } {
  if (attempts >= MAX_ATTEMPTS) return { status: 'failed' };
  const delay = Math.min(FIRST_RETRY_MS * 2 ** Math.max(0, attempts - 1), MAX_RETRY_MS);
  return { status: 'pending', nextAttemptAt: new Date(now.getTime() + delay) };
}

/** last_error is for people reading the table: one short line, no stack. */
export function errorText(err: unknown): string {
  const text = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return text.replace(/\s+/g, ' ').slice(0, 500);
}
