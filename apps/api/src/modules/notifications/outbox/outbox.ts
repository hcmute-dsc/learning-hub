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
  /** payload: ReviewRequestedPayload → one bell row per mentor */
  ReviewRequested: 'inbox.review_requested',
  /** payload: TrackPublishedPayload → one bell row per active member */
  TrackPublished: 'inbox.track_published',
  /** payload: EmailDigestPayload → one email */
  EmailDigest: 'email.digest',
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
