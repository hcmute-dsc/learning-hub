import type { QuizAttemptInput, QuizQuestionView, QuizResult } from '@hub/shared';

/**
 * Quiz form rules, kept out of the component so they can be unit tested
 * (quiz-answers.test.ts). Answer shapes follow `quizAttemptSchema` in @hub/shared:
 * single → option index, multiple → option indexes, short_text → text.
 */

/** What the member has entered so far, by question id. */
export type QuizDraft = Record<string, number | number[] | string>;

export function isAnswered(question: QuizQuestionView, value: QuizDraft[string] | undefined) {
  if (value === undefined) return false;
  if (question.type === 'single') return typeof value === 'number';
  if (question.type === 'multiple') return Array.isArray(value) && value.length > 0;
  return typeof value === 'string' && value.trim() !== '';
}

export function countAnswered(questions: QuizQuestionView[], draft: QuizDraft): number {
  let count = 0;
  for (const question of questions) {
    if (isAnswered(question, draft[question.id])) count += 1;
  }
  return count;
}

/** Ticks or unticks one option of a "multiple" question; the result stays sorted. */
export function toggleOption(current: QuizDraft[string] | undefined, index: number, on: boolean) {
  const selected = Array.isArray(current) ? current.filter((i) => i !== index) : [];
  if (on) selected.push(index);
  return selected.sort((a, b) => a - b);
}

/** Request body for POST /exercises/:id/quiz-attempts (only answered questions). */
export function toAttemptInput(questions: QuizQuestionView[], draft: QuizDraft): QuizAttemptInput {
  const answers: QuizAttemptInput['answers'] = {};
  for (const question of questions) {
    const value = draft[question.id];
    if (!isAnswered(question, value)) continue;
    answers[question.id] = typeof value === 'string' ? value.trim() : (value as number | number[]);
  }
  return { answers };
}

/** The correct answer as text, e.g. "B. map" or "a / b" (accepted short answers). */
export function describeCorrectAnswer(
  question: QuizQuestionView,
  correct: QuizResult['questions'][number]['correctAnswer'],
): string {
  if (question.type === 'short_text') {
    return Array.isArray(correct) ? correct.join(' / ') : String(correct);
  }
  const indexes = Array.isArray(correct) ? correct : [correct];
  const parts: string[] = [];
  for (const index of indexes) {
    const option = typeof index === 'number' ? question.options[index] : undefined;
    parts.push(option === undefined ? String(index) : `${optionLetter(Number(index))}. ${option}`);
  }
  return parts.join('; ');
}

/** 0 → "A", 1 → "B"… so answers can be referred to without relying on position or color. */
export function optionLetter(index: number): string {
  return String.fromCharCode(65 + (index % 26));
}

/** True when option `index` is part of the member's answer to a single/multiple question. */
export function isChosen(value: QuizDraft[string] | undefined, index: number): boolean {
  return Array.isArray(value) ? value.includes(index) : value === index;
}

/**
 * How one option row looks. Before grading: `selected` or `idle`. After grading:
 * `correct` (chosen and right), `wrong` (chosen but not right), `missed` (right but
 * not chosen) or `idle`.
 */
export type OptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'missed';

export function optionState(
  value: QuizDraft[string] | undefined,
  index: number,
  correctAnswer: QuizResult['questions'][number]['correctAnswer'] | null,
): OptionState {
  const chosen = isChosen(value, index);
  if (correctAnswer === null) return chosen ? 'selected' : 'idle';

  const right = Array.isArray(correctAnswer)
    ? (correctAnswer as (number | string)[]).includes(index)
    : correctAnswer === index;
  if (chosen) return right ? 'correct' : 'wrong';
  return right ? 'missed' : 'idle';
}

/** Number of correct questions in a graded attempt, for the score summary. */
export function countCorrect(result: QuizResult): number {
  let count = 0;
  for (const question of result.questions) {
    if (question.correct) count += 1;
  }
  return count;
}
