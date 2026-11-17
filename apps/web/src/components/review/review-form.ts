import type { ReviewOutcome, RubricScoreInput } from '@hub/shared';

/**
 * Pure helpers for the mentor review pages (E7), tested in review-form.test.ts.
 * The API checks the same rules again (review-rules.ts); these only give quick feedback.
 */

type Rubric = { criterion: string; weight: number }[];

/** Score per criterion while the mentor types; '' = not scored yet. */
export type ScoreDraft = Record<string, string>;

export function emptyScores(rubric: Rubric): ScoreDraft {
  const draft: ScoreDraft = {};
  for (const row of rubric) draft[row.criterion] = '';
  return draft;
}

/** A whole number 0..weight, or null when the text is not one. */
export function parseScore(text: string, weight: number): number | null {
  if (!/^\d+$/.test(text.trim())) return null;
  const value = Number(text.trim());
  return value <= weight ? value : null;
}

/**
 * Live total on a 0–100 scale (earned / possible), counting only valid scores so far,
 * the same formula as the API's rubricTotal. `complete` tells whether every
 * criterion has a valid score.
 */
export function liveTotal(
  rubric: Rubric,
  draft: ScoreDraft,
): { total: number; earned: number; possible: number; complete: boolean } {
  let earned = 0;
  let possible = 0;
  let complete = true;
  for (const row of rubric) {
    possible += row.weight;
    const score = parseScore(draft[row.criterion] ?? '', row.weight);
    if (score === null) complete = false;
    else earned += score;
  }
  const total = possible === 0 ? 0 : Math.round((earned / possible) * 100);
  return { total, earned, possible, complete };
}

export interface ReviewFormErrors {
  scores?: string;
  summary?: string;
}

/**
 * What blocks sending: a rubric must be fully scored (a partial one would be a
 * misleading total), and asking for changes needs a summary saying what to fix.
 */
export function validateReview(input: {
  rubric: Rubric;
  draft: ScoreDraft;
  outcome: ReviewOutcome | null;
  summary: string;
}): ReviewFormErrors & { outcome?: string } {
  const errors: ReviewFormErrors & { outcome?: string } = {};
  if (input.rubric.length > 0 && !liveTotal(input.rubric, input.draft).complete) {
    errors.scores = 'Chấm đủ mọi tiêu chí, mỗi điểm là số nguyên từ 0 đến trọng số.';
  }
  if (!input.outcome) errors.outcome = 'Chọn kết quả: Đạt hoặc Cần sửa.';
  if (input.outcome === 'changes_requested' && input.summary.trim() === '') {
    errors.summary = 'Hãy viết nhận xét để thành viên biết cần sửa gì.';
  }
  return errors;
}

/** The scores to send, in rubric order; call only after validateReview passed. */
export function scoresToSend(rubric: Rubric, draft: ScoreDraft): RubricScoreInput[] {
  return rubric.map((row) => ({
    criterion: row.criterion,
    score: parseScore(draft[row.criterion] ?? '', row.weight) ?? 0,
  }));
}

/** 5 → "5 giờ", 50 → "2 ngày 2 giờ", 0 → "dưới 1 giờ". */
export function formatWaiting(hours: number): string {
  if (hours < 1) return 'dưới 1 giờ';
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  if (days === 0) return `${rest} giờ`;
  return rest === 0 ? `${days} ngày` : `${days} ngày ${rest} giờ`;
}
