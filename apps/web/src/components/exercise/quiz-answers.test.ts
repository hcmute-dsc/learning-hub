import { describe, expect, it } from 'vitest';
import type { QuizQuestionView } from '@hub/shared';
import {
  countAnswered,
  describeCorrectAnswer,
  toAttemptInput,
  toggleOption,
  type QuizDraft,
} from './quiz-answers';

const single: QuizQuestionView = { id: 'q1', type: 'single', prompt: '?', options: ['a', 'b'] };
const multiple: QuizQuestionView = {
  id: 'q2',
  type: 'multiple',
  prompt: '?',
  options: ['x', 'y', 'z'],
};
const text: QuizQuestionView = { id: 'q3', type: 'short_text', prompt: '?' };
const questions = [single, multiple, text];

describe('countAnswered', () => {
  it('ignores empty selections and blank text', () => {
    const draft: QuizDraft = { q1: 0, q2: [], q3: '   ' };
    expect(countAnswered(questions, draft)).toBe(1);
  });

  it('counts index 0 as an answer', () => {
    expect(countAnswered([single], { q1: 0 })).toBe(1);
  });
});

describe('toggleOption', () => {
  it('adds and removes options and keeps them sorted', () => {
    expect(toggleOption(undefined, 2, true)).toEqual([2]);
    expect(toggleOption([2], 0, true)).toEqual([0, 2]);
    expect(toggleOption([0, 2], 2, false)).toEqual([0]);
  });
});

describe('toAttemptInput', () => {
  it('sends answered questions only, with trimmed text', () => {
    const draft: QuizDraft = { q1: 1, q2: [], q3: '  git status ' };
    expect(toAttemptInput(questions, draft)).toEqual({ answers: { q1: 1, q3: 'git status' } });
  });
});

describe('describeCorrectAnswer', () => {
  it('names options with a letter', () => {
    expect(describeCorrectAnswer(single, 1)).toBe('B. b');
    expect(describeCorrectAnswer(multiple, [0, 2])).toBe('A. x; C. z');
  });

  it('lists accepted short answers', () => {
    expect(describeCorrectAnswer(text, ['main', 'master'])).toBe('main / master');
  });
});
