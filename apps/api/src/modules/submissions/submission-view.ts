import type { QuizAttemptInput, SubmissionStatus, SubmissionView } from '@hub/shared';

/**
 * What a quiz submission stores in `submissions.answers`. The table has no score
 * column (DATABASE.md), so the score is kept next to the answers it was computed from.
 */
export interface StoredQuizAnswers {
  answers: QuizAttemptInput['answers'];
  score: number;
}

/** The submission columns (plus exercise title) needed to build a SubmissionView. */
export interface SubmissionRow {
  id: string;
  exerciseId: string;
  attempt: number;
  sourceType: string;
  sourceUrl: string | null;
  note: string | null;
  status: string;
  answers: unknown;
  submittedAt: Date;
  exercise: { title: string };
}

/** Prisma `select` matching SubmissionRow, so every query loads the same columns. */
export const SUBMISSION_ROW_SELECT = {
  id: true,
  exerciseId: true,
  attempt: true,
  sourceType: true,
  sourceUrl: true,
  note: true,
  status: true,
  answers: true,
  submittedAt: true,
  exercise: { select: { title: true } },
} as const;

/** Score of a quiz submission, null for every other kind (or a malformed row). */
export function scoreOf(row: { sourceType: string; answers: unknown }): number | null {
  if (row.sourceType !== 'quiz_answers') return null;
  const score = (row.answers as Partial<StoredQuizAnswers> | null)?.score;
  return typeof score === 'number' ? score : null;
}

export function toSubmissionView(row: SubmissionRow): SubmissionView {
  return {
    id: row.id,
    exerciseId: row.exerciseId,
    exerciseTitle: row.exercise.title,
    attempt: row.attempt,
    sourceType: row.sourceType as SubmissionView['sourceType'],
    sourceUrl: row.sourceUrl,
    note: row.note,
    status: row.status as SubmissionStatus,
    score: scoreOf(row),
    submittedAt: row.submittedAt.toISOString(),
  };
}
