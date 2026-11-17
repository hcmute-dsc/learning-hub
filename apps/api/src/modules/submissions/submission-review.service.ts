import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Prisma } from '@prisma/client';
import type { SubmissionStatus } from '@hub/shared';
import { DomainError } from '../../common/errors';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CatalogReader, type ExerciseContext } from '../catalog/catalog.reader';
import { projectSpec } from './exercise-spec';
import { SubmissionEvents, type SubmissionEvent } from './submissions.events';

/** How many waiting submissions the queue shows at most (oldest first). */
const QUEUE_LIMIT = 200;

/** A submission with the fields the review pages need. */
export interface SubmissionForReview {
  id: string;
  userId: string;
  exerciseId: string;
  attempt: number;
  status: SubmissionStatus;
  sourceUrl: string | null;
  note: string | null;
  submittedAt: Date;
}

/** One row of the review queue: the submission plus exercise and track titles. */
export interface QueuedSubmission extends SubmissionForReview {
  exercise: { id: string; title: string };
  track: { slug: string; title: string };
}

const REVIEW_SELECT = {
  id: true,
  userId: true,
  exerciseId: true,
  attempt: true,
  status: true,
  sourceUrl: true,
  note: true,
  submittedAt: true,
} as const;

type ReviewOutcome = 'approved' | 'changes_requested';

/**
 * The part of the submissions module that the reviews module uses (E7). Submissions
 * stay the owner of their table and their status: reviews never write `submissions`
 * directly, they call `recordReviewOutcome`.
 */
@Injectable()
export class SubmissionReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogReader,
    private readonly events: EventEmitter2,
  ) {}

  /** Project submissions waiting for a mentor, oldest first (partial index on submitted_at). */
  async awaitingReview(): Promise<QueuedSubmission[]> {
    const rows = await this.prisma.submission.findMany({
      where: { status: 'awaiting_review' },
      orderBy: { submittedAt: 'asc' },
      take: QUEUE_LIMIT,
      select: {
        ...REVIEW_SELECT,
        exercise: {
          select: {
            id: true,
            title: true,
            module: { select: { track: { select: { slug: true, title: true } } } },
          },
        },
      },
    });
    return rows.map(({ exercise, ...row }) => ({
      ...row,
      status: row.status as SubmissionStatus,
      exercise: { id: exercise.id, title: exercise.title },
      track: exercise.module.track,
    }));
  }

  /**
   * One submission, its exercise (with the rubric of a project) and the member's
   * earlier attempts, newest first. 404 when the submission or its exercise is gone.
   */
  async forReview(submissionId: string): Promise<{
    submission: SubmissionForReview;
    exercise: ExerciseContext;
    rubric: { criterion: string; weight: number }[];
    earlierAttempts: SubmissionForReview[];
  }> {
    const row = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: REVIEW_SELECT,
    });
    if (!row) throw DomainError.notFound('Submission');
    const [exercise, earlier] = await Promise.all([
      this.catalog.exercise(row.exerciseId),
      this.prisma.submission.findMany({
        where: { userId: row.userId, exerciseId: row.exerciseId, attempt: { lt: row.attempt } },
        orderBy: { attempt: 'desc' },
        select: REVIEW_SELECT,
      }),
    ]);
    const typed = (r: typeof row): SubmissionForReview => ({
      ...r,
      status: r.status as SubmissionStatus,
    });
    const rubric =
      exercise.type === 'project'
        ? projectSpec(exercise.spec).rubric.map((r) => ({
            criterion: r.criterion,
            weight: r.weight,
          }))
        : [];
    return { submission: typed(row), exercise, rubric, earlierAttempts: earlier.map(typed) };
  }

  /**
   * A mentor finished a review: the submission becomes approved / changes_requested.
   * `alsoWrite` lets the reviews module save its own row in the same transaction, so
   * the review and the submission never disagree. Events go out after the commit, so
   * listeners (track completion, notifications) read the new status.
   * 409 when the submission is no longer waiting for review.
   */
  async recordReviewOutcome(
    submissionId: string,
    outcome: ReviewOutcome,
    alsoWrite: (tx: Prisma.TransactionClient) => Promise<void> = async () => {},
  ): Promise<SubmissionEvent> {
    const event = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.submission.updateMany({
        where: { id: submissionId, status: 'awaiting_review' },
        data: { status: outcome },
      });
      if (updated.count === 0) {
        throw DomainError.conflict('Bài nộp này không còn chờ review.');
      }
      await alsoWrite(tx);
      const row = await tx.submission.findUniqueOrThrow({
        where: { id: submissionId },
        select: { id: true, userId: true, exerciseId: true, status: true },
      });
      return {
        submissionId: row.id,
        userId: row.userId,
        exerciseId: row.exerciseId,
        status: row.status,
      };
    });

    const name =
      outcome === 'approved' ? SubmissionEvents.Approved : SubmissionEvents.ChangesRequested;
    await this.events.emitAsync(name, event);
    return event;
  }
}
