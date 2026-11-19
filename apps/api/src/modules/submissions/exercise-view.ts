import type { ExerciseState, ExerciseView, ItemRef, QuizQuestionView } from '@hub/shared';
import type { ExerciseContext } from '../catalog/catalog.reader';
import {
  codeSpec,
  projectSpec,
  quizSpec,
  selfCheckSpec,
  type QuizQuestionSpec,
} from './exercise-spec';
import { toHintsView, toSolutionView } from './hints';

/**
 * Build the member-facing exercise (contract: ExerciseView in @hub/shared).
 * Pure so the "never leak quiz answers" rule has a unit test.
 */

/** Only prompt and options: `answer` and `explanation` stay on the server until an attempt. */
export function toQuizQuestionView(question: QuizQuestionSpec): QuizQuestionView {
  if (question.type === 'short_text') {
    return { id: question.id, type: 'short_text', prompt: question.prompt };
  }
  return {
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    options: [...question.options],
  };
}

/** Exactly one type-specific block is set, matching `exercise.type`. */
function typeDetails(
  exercise: ExerciseContext,
): Pick<ExerciseView, 'quiz' | 'selfCheck' | 'project' | 'code'> {
  switch (exercise.type) {
    case 'quiz': {
      const spec = quizSpec(exercise.spec);
      return {
        quiz: { passScore: spec.passScore, questions: spec.questions.map(toQuizQuestionView) },
      };
    }
    case 'self_check':
      return { selfCheck: { checklist: [...selfCheckSpec(exercise.spec).checklist] } };
    case 'project': {
      const spec = projectSpec(exercise.spec);
      return {
        project: {
          deliverable: spec.deliverable,
          rubric: spec.rubric.map((r) => ({ criterion: r.criterion, weight: r.weight })),
        },
      };
    }
    case 'code': {
      const spec = codeSpec(exercise.spec);
      return {
        code: {
          starterRepo: exercise.track.starterRepo,
          starterPath: spec.starterPath,
          submitKind: spec.submit.kind,
        },
      };
    }
  }
}

export function toExerciseView(
  exercise: ExerciseContext,
  member: {
    state: ExerciseState;
    lockedBy: ItemRef[];
    attempts: number;
    openedHints: ReadonlySet<number>;
    /** from canSeeSolution (hints.ts) */
    solutionUnlocked: boolean;
  },
): ExerciseView {
  return {
    id: exercise.id,
    slug: exercise.slug,
    title: exercise.title,
    type: exercise.type,
    difficulty: exercise.difficulty,
    statementMd: exercise.statementMd,
    requiresReview: exercise.requiresReview,
    state: member.state,
    // The contract promises an empty list unless the exercise is locked.
    lockedBy: member.state === 'locked' ? member.lockedBy : [],
    track: { slug: exercise.track.slug, title: exercise.track.title },
    module: exercise.module,
    lesson: exercise.lesson,
    attempts: member.attempts,
    hints: toHintsView(exercise.hints, {
      opened: member.openedHints,
      attempts: member.attempts,
      state: member.state,
    }),
    solution: toSolutionView(exercise.solutionMd, member.solutionUnlocked),
    ...typeDetails(exercise),
  };
}
