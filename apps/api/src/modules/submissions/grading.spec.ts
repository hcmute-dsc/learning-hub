import type { QuizSpec } from './exercise-spec';
import { gradeQuiz, isCorrect, normalizeShortText } from './grading';

const spec: QuizSpec = {
  shuffle: false,
  passScore: 0.7,
  questions: [
    { id: 'q1', type: 'single', prompt: 'p', options: ['a', 'b'], answer: 1, explanation: 'why' },
    { id: 'q2', type: 'multiple', prompt: 'p', options: ['a', 'b', 'c'], answer: [2, 0] },
    { id: 'q3', type: 'short_text', prompt: 'p', answer: ['git hub', 'GitHub'] },
  ],
};

describe('normalizeShortText', () => {
  it('trims, lower-cases and collapses inner spaces', () => {
    expect(normalizeShortText('  Git \t  Hub ')).toBe('git hub');
  });
});

describe('isCorrect', () => {
  const [single, multiple, short] = spec.questions;

  it('single: the index must be equal', () => {
    expect(isCorrect(single, 1)).toBe(true);
    expect(isCorrect(single, 0)).toBe(false);
    expect(isCorrect(single, [1])).toBe(false);
  });

  it('multiple: same set, order and duplicates do not matter', () => {
    expect(isCorrect(multiple, [0, 2])).toBe(true);
    expect(isCorrect(multiple, [2, 0, 0])).toBe(true);
    expect(isCorrect(multiple, [0])).toBe(false);
    expect(isCorrect(multiple, [0, 1, 2])).toBe(false);
    expect(isCorrect(multiple, 0)).toBe(false);
  });

  it('short_text: normalized match against any accepted answer', () => {
    expect(isCorrect(short, '  GIT   hub ')).toBe(true);
    expect(isCorrect(short, 'github')).toBe(true);
    expect(isCorrect(short, 'gitlab')).toBe(false);
    expect(isCorrect(short, 3)).toBe(false);
  });

  it('a missing answer is wrong', () => {
    expect(isCorrect(single, undefined)).toBe(false);
    expect(isCorrect(multiple, undefined)).toBe(false);
    expect(isCorrect(short, undefined)).toBe(false);
  });
});

describe('gradeQuiz', () => {
  it('passes when every answer is right and reveals answers + explanations', () => {
    const grade = gradeQuiz(spec, { q1: 1, q2: [0, 2], q3: 'GitHub' });
    expect(grade.score).toBe(1);
    expect(grade.passed).toBe(true);
    expect(grade.questions).toEqual([
      { id: 'q1', correct: true, correctAnswer: 1, explanation: 'why' },
      { id: 'q2', correct: true, correctAnswer: [0, 2], explanation: null },
      { id: 'q3', correct: true, correctAnswer: ['git hub', 'GitHub'], explanation: null },
    ]);
  });

  it('fails below passScore and counts missing answers as wrong', () => {
    const grade = gradeQuiz(spec, { q1: 1, q2: [0, 2] });
    expect(grade.score).toBeCloseTo(2 / 3);
    expect(grade.passed).toBe(false);
    expect(grade.questions[2].correct).toBe(false);
  });

  it('passes exactly at passScore and ignores unknown question ids', () => {
    const grade = gradeQuiz({ ...spec, passScore: 2 / 3 }, { q1: 1, q2: [0, 2], extra: 5 });
    expect(grade.passed).toBe(true);
    expect(grade.questions).toHaveLength(3);
  });
});
