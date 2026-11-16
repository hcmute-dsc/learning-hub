import { Injectable } from '@nestjs/common';
import type { ExerciseView, QuizAttemptInput, QuizResult, SubmissionView } from '@hub/shared';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CatalogReader } from '../catalog/catalog.reader';
import { ExerciseStateService } from './exercise-state.service';
import { quizSpec } from './exercise-spec';
import { toExerciseView } from './exercise-view';
import { gradeQuiz } from './grading';
import { SubmissionWriter } from './submission-writer';
import {
  SUBMISSION_ROW_SELECT,
  toSubmissionView,
  type StoredQuizAnswers,
  type SubmissionRow,
} from './submission-view';
import { assertCanSubmit } from './submit-rules';

/**
 * Reading an exercise and the two instant-feedback kinds: quiz attempts and
 * self-checks (USER-FLOWS: làm bài quiz / tự đánh giá). Link submissions for code
 * and project exercises live in SubmissionsService.
 */
@Injectable()
export class ExercisesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogReader,
    private readonly states: ExerciseStateService,
    private readonly writer: SubmissionWriter,
  ) {}

  async view(userId: string, exerciseId: string): Promise<ExerciseView> {
    const exercise = await this.catalog.exercise(exerciseId);
    const [details, attempts] = await Promise.all([
      this.states.detailsFor(userId, [exercise.id]),
      this.prisma.submission.count({ where: { userId, exerciseId: exercise.id } }),
    ]);
    const { state, lockedBy: lockedIds } = details.get(exercise.id)!;
    // Titles come from the catalog; which ones lock it comes from the one rule.
    const lockedBy = exercise.prerequisites.filter((p) => lockedIds.includes(p.id));
    return toExerciseView(exercise, { state, lockedBy, attempts });
  }

  /** Graded on the server; correct answers are revealed only in this response. */
  async attemptQuiz(
    userId: string,
    exerciseId: string,
    input: QuizAttemptInput,
  ): Promise<QuizResult> {
    const exercise = await this.catalog.exercise(exerciseId);
    const state = await this.states.stateOf(userId, exercise.id);
    assertCanSubmit({ type: exercise.type, state }, ['quiz']);
    const grade = gradeQuiz(quizSpec(exercise.spec), input.answers);
    const stored: StoredQuizAnswers = { answers: input.answers, score: grade.score };
    const row = await this.writer.create({
      userId,
      exerciseId: exercise.id,
      contentVersionId: exercise.contentVersionId,
      sourceType: 'quiz_answers',
      status: grade.passed ? 'passed' : 'failed',
      answers: stored as object,
    });
    return { submissionId: row.id, attempt: row.attempt, ...grade };
  }

  /**
   * Idempotent: ticking the checklist again on a completed exercise returns the
   * existing submission instead of adding attempts (the button may be clicked twice).
   */
  async selfCheck(
    userId: string,
    exerciseId: string,
  ): Promise<{ created: boolean; submission: SubmissionView }> {
    const exercise = await this.catalog.exercise(exerciseId);
    const state = await this.states.stateOf(userId, exercise.id);
    if (exercise.type === 'self_check' && state === 'completed') {
      const latest = await this.latestSubmission(userId, exercise.id);
      if (latest) return { created: false, submission: toSubmissionView(latest) };
    }
    assertCanSubmit({ type: exercise.type, state }, ['self_check']);
    const row = await this.writer.create({
      userId,
      exerciseId: exercise.id,
      contentVersionId: exercise.contentVersionId,
      sourceType: 'self_check',
      status: 'passed',
    });
    return { created: true, submission: toSubmissionView(row) };
  }

  private latestSubmission(userId: string, exerciseId: string): Promise<SubmissionRow | null> {
    return this.prisma.submission.findFirst({
      where: { userId, exerciseId },
      orderBy: [{ submittedAt: 'desc' }, { attempt: 'desc' }],
      select: SUBMISSION_ROW_SELECT,
    });
  }
}
