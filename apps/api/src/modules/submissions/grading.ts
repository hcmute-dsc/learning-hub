import type { QuizAttemptInput, QuizResult } from '@hub/shared';
import type { QuizQuestionSpec, QuizSpec } from './exercise-spec';

type Answer = QuizAttemptInput['answers'][string] | undefined;

/** The graded quiz without the submission fields (id, attempt) that the database adds. */
export type QuizGrade = Omit<QuizResult, 'submissionId' | 'attempt'>;

/**
 * Short answers are compared loosely so "  Git  Hub " matches "git hub":
 * trim, lower-case, collapse inner whitespace (USER-FLOWS: quiz chấm tức thì).
 */
export function normalizeShortText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** A missing answer, or an answer of the wrong shape, is simply wrong (never an error). */
export function isCorrect(question: QuizQuestionSpec, answer: Answer): boolean {
  switch (question.type) {
    case 'single':
      return typeof answer === 'number' && answer === question.answer;
    case 'multiple': {
      if (!Array.isArray(answer)) return false;
      const given = new Set(answer);
      const expected = new Set(question.answer);
      if (given.size !== expected.size) return false;
      for (const index of given) {
        if (!expected.has(index)) return false;
      }
      return true;
    }
    case 'short_text': {
      if (typeof answer !== 'string') return false;
      const given = normalizeShortText(answer);
      return question.answer.some((accepted) => normalizeShortText(accepted) === given);
    }
  }
}

function correctAnswerOf(question: QuizQuestionSpec): number | number[] | string[] {
  if (question.type === 'multiple') return [...question.answer].sort((a, b) => a - b);
  return question.answer;
}

/**
 * Grade a quiz attempt on the server (the answers never reach the browser before an
 * attempt, see ExerciseView). score = correct / total, passed = score >= passScore.
 * Answers for unknown question ids are ignored.
 */
export function gradeQuiz(spec: QuizSpec, answers: QuizAttemptInput['answers']): QuizGrade {
  let correctCount = 0;
  const questions: QuizGrade['questions'] = [];
  for (const question of spec.questions) {
    const correct = isCorrect(question, answers[question.id]);
    if (correct) correctCount += 1;
    questions.push({
      id: question.id,
      correct,
      correctAnswer: correctAnswerOf(question),
      explanation: question.explanation ?? null,
    });
  }
  const score = spec.questions.length ? correctCount / spec.questions.length : 0;
  return { score, passed: score >= spec.passScore, questions };
}
