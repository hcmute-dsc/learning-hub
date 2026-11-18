import type { RubricScoreInput, RubricScoreView, Role, SubmissionStatus } from '@hub/shared';
import { DomainError } from '../../common/errors';

/**
 * Pure rules of the mentor review flow (E7, SECURITY §2, BACKEND-DESIGN §3 ReviewPolicy).
 * Kept free of Nest and Prisma so each rule has a plain unit test (review-rules.spec.ts).
 */

interface Viewer {
  id: string;
  roles: Role[];
}

interface ReviewState {
  reviewerId: string;
  status: string;
}

/** Nobody reviews their own work, not even an admin (SECURITY §2). */
export function assertNotOwnSubmission(viewer: Viewer, memberId: string): void {
  if (viewer.id === memberId) {
    throw DomainError.forbidden('Bạn không thể review bài nộp của chính mình.');
  }
}

/**
 * "Nhận review": only a submission waiting for review, and only when nobody holds it.
 * 403 for your own submission, 409 for a wrong state or an existing claim.
 */
export function assertCanClaim(input: {
  viewer: Viewer;
  submission: { userId: string; status: SubmissionStatus };
  openReview: { reviewerId: string } | null;
}): void {
  const { viewer, submission, openReview } = input;
  assertNotOwnSubmission(viewer, submission.userId);
  if (submission.status !== 'awaiting_review') {
    throw DomainError.conflict('Bài nộp này không còn chờ review.');
  }
  if (openReview) {
    throw DomainError.conflict(
      openReview.reviewerId === viewer.id
        ? 'Bạn đã nhận review bài này rồi.'
        : 'Một mentor khác đã nhận review bài này.',
    );
  }
}

/** "Bỏ nhận": the reviewer gives it back, or an admin frees a forgotten claim. */
export function assertCanRelease(viewer: Viewer, review: ReviewState): void {
  if (viewer.id !== review.reviewerId && !viewer.roles.includes('admin')) {
    throw DomainError.forbidden('Chỉ mentor đã nhận review (hoặc admin) mới bỏ nhận được.');
  }
  if (review.status !== 'in_progress') {
    throw DomainError.conflict('Review này đã hoàn thành, không bỏ nhận được.');
  }
}

/** Only the mentor who claimed the review completes it (the outcome carries their name). */
export function assertCanComplete(viewer: Viewer, review: ReviewState): void {
  if (viewer.id !== review.reviewerId) {
    throw DomainError.forbidden('Chỉ mentor đã nhận review mới hoàn thành được.');
  }
  if (review.status !== 'in_progress') {
    throw DomainError.conflict('Review này đã hoàn thành rồi.');
  }
}

function invalidScores(message: string): DomainError {
  return new DomainError('VALIDATION_FAILED', 422, 'Điểm rubric không hợp lệ', [
    { path: 'rubricScores', message },
  ]);
}

/**
 * Check the mentor's scores against the exercise rubric and return them in rubric
 * order with each weight copied in (stored, so the total never changes later).
 * Scores are optional, but when given every criterion gets exactly one score in 0..weight.
 * An exercise without a rubric accepts no scores.
 */
export function scoreRubric(
  rubric: { criterion: string; weight: number }[],
  scores: RubricScoreInput[] | undefined,
): RubricScoreView[] {
  if (!scores || scores.length === 0) return [];
  if (rubric.length === 0) throw invalidScores('Bài tập này không có rubric.');

  const given = new Map<string, number>();
  for (const s of scores) {
    if (given.has(s.criterion)) throw invalidScores(`Tiêu chí "${s.criterion}" bị chấm hai lần.`);
    given.set(s.criterion, s.score);
  }

  const result: RubricScoreView[] = [];
  for (const row of rubric) {
    const score = given.get(row.criterion);
    if (score === undefined) throw invalidScores(`Thiếu điểm cho tiêu chí "${row.criterion}".`);
    if (score < 0 || score > row.weight) {
      throw invalidScores(`Điểm của "${row.criterion}" phải từ 0 đến ${row.weight}.`);
    }
    result.push({ criterion: row.criterion, weight: row.weight, score });
    given.delete(row.criterion);
  }
  const unknown = [...given.keys()];
  if (unknown.length) throw invalidScores(`Tiêu chí không có trong rubric: "${unknown[0]}".`);
  return result;
}

/**
 * Total on a 0–100 scale: points earned / points possible. Rubric weights are relative
 * numbers (CONTENT-SPECIFICATION), so a rubric that does not sum to 100 still gives a
 * fair percentage. Null when nothing was scored.
 */
export function rubricTotal(scores: { weight: number; score: number }[]): number | null {
  let earned = 0;
  let possible = 0;
  for (const s of scores) {
    earned += s.score;
    possible += s.weight;
  }
  if (possible === 0) return null;
  return Math.round((earned / possible) * 100);
}

/** Whole hours a submission has waited, and whether that is past the review target. */
export function waitingTime(
  submittedAt: Date,
  now: Date,
  targetHours: number,
): { hoursWaiting: number; overTarget: boolean } {
  const ms = Math.max(0, now.getTime() - submittedAt.getTime());
  const hoursWaiting = Math.floor(ms / 3_600_000);
  return { hoursWaiting, overTarget: ms > targetHours * 3_600_000 };
}

/**
 * Active mentees with no activity for `days` days. A mentee's last activity is the
 * latest of: assignment start, last submission, last lesson progress; a mentee just
 * assigned is therefore not "inactive" on day one. A mentee with several active
 * assignments (one per track) is counted once.
 */
export function countInactiveMentees(
  mentees: { menteeId: string; startedAt: Date | null }[],
  lastActivity: Map<string, Date>,
  now: Date,
  days: number,
): number {
  const cutoff = now.getTime() - days * 86_400_000;
  const last = latestActivity(
    mentees.map((m) => ({ userId: m.menteeId, at: m.startedAt })),
    [...lastActivity].map(([userId, at]) => ({ userId, at })),
  );
  const ids = new Set(mentees.map((m) => m.menteeId));
  let inactive = 0;
  for (const id of ids) {
    const at = last.get(id);
    if (!at || at.getTime() < cutoff) inactive += 1;
  }
  return inactive;
}

/** menteeId → latest of several activity dates (null dates are ignored). */
export function latestActivity(
  ...sources: { userId: string; at: Date | null }[][]
): Map<string, Date> {
  const latest = new Map<string, Date>();
  for (const rows of sources) {
    for (const { userId, at } of rows) {
      if (!at) continue;
      const prev = latest.get(userId);
      if (!prev || at > prev) latest.set(userId, at);
    }
  }
  return latest;
}
