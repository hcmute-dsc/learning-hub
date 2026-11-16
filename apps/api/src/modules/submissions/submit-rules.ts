import type { ExerciseState, ExerciseType, Role, SubmissionStatus } from '@hub/shared';
import { DomainError } from '../../common/errors';
import type { CodeSpec, ProjectSpec } from './exercise-spec';
import type { AcceptedUrl } from './submission-url';

/**
 * Pure rules shared by the submit endpoints (BACKEND-DESIGN §3.7, USER-FLOWS).
 * Kept free of Nest and Prisma so each rule has a plain unit test.
 */

const TYPE_LABEL: Record<ExerciseType, string> = {
  code: 'bài code',
  quiz: 'bài trắc nghiệm',
  project: 'bài dự án',
  self_check: 'bài tự đánh giá',
};

/**
 * 409 when this endpoint does not fit the exercise or the member may not submit now.
 * `completed` blocks a new attempt: a finished exercise is never re-graded (the
 * self-check endpoint handles its own idempotent case before calling this).
 */
export function assertCanSubmit(
  exercise: { type: ExerciseType; state: ExerciseState },
  endpointTypes: ExerciseType[],
): void {
  assertEndpointFits(exercise.type, endpointTypes);
  assertOpen(exercise.state);
}

/** 409 when the exercise type is not handled by this endpoint. */
export function assertEndpointFits(type: ExerciseType, endpointTypes: ExerciseType[]): void {
  if (!endpointTypes.includes(type)) {
    throw DomainError.conflict(`Đây là ${TYPE_LABEL[type]}, không nộp được theo cách này.`);
  }
}

/** 409 when prerequisites are missing or the exercise is already done. */
export function assertOpen(state: ExerciseState): void {
  if (state === 'locked') {
    throw DomainError.conflict('Bài tập đang bị khóa: hãy hoàn thành các bài yêu cầu trước.');
  }
  if (state === 'completed') {
    throw DomainError.conflict('Bạn đã hoàn thành bài tập này rồi.');
  }
}

/** Which URL a code/project exercise accepts, read from its spec. */
export function acceptedUrlFor(
  exercise: { type: 'code'; spec: CodeSpec } | { type: 'project'; spec: ProjectSpec },
): AcceptedUrl {
  return exercise.type === 'code' ? exercise.spec.submit.kind : exercise.spec.deliverable;
}

/**
 * Status of a new link submission: code waits for automatic checks (E6 moves it to
 * testing/passed/failed); a project goes straight to the mentor review queue.
 */
export function linkSubmissionStatus(
  type: 'code' | 'project',
): Extract<SubmissionStatus, 'submitted' | 'awaiting_review'> {
  return type === 'code' ? 'submitted' : 'awaiting_review';
}

/** Attempts are numbered 1, 2, 3… per member and exercise. */
export function nextAttempt(maxAttempt: number | null | undefined): number {
  return (maxAttempt ?? 0) + 1;
}

/** Idempotency-Key must be a UUID (BACKEND-DESIGN §3.7). A missing or bad key is a 400. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseIdempotencyKey(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value || !UUID.test(value.trim())) {
    throw new DomainError('BAD_REQUEST', 400, 'Thiếu header Idempotency-Key (UUID) hợp lệ.');
  }
  return value.trim().toLowerCase();
}

/**
 * Same Idempotency-Key again: the same request is a safe retry (→ 200 with the original
 * submission); anything different under the same key is a client bug (→ 422).
 */
export function assertSameRequest(
  original: { exerciseId: string; sourceUrl: string | null },
  retry: { exerciseId: string; sourceUrl: string },
): void {
  if (original.exerciseId !== retry.exerciseId || original.sourceUrl !== retry.sourceUrl) {
    throw new DomainError(
      'VALIDATION_FAILED',
      422,
      'Idempotency-Key này đã được dùng cho một bài nộp khác.',
    );
  }
}

/**
 * Who may read a submission (SECURITY §2): its owner, mentors and admins. Everyone
 * else gets a 404 so the id does not reveal that the submission exists.
 * TODO(E7): narrow mentors to their assigned mentees once mentorship exists.
 */
export function canViewSubmission(viewer: { id: string; roles: Role[] }, ownerId: string): boolean {
  if (viewer.id === ownerId) return true;
  return viewer.roles.includes('mentor') || viewer.roles.includes('admin');
}
