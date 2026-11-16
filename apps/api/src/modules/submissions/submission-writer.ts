import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Prisma } from '@prisma/client';
import { newId } from '../../infrastructure/ids';
import { isUniqueViolation } from '../../infrastructure/prisma/errors';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SubmissionEvents, type SubmissionEvent } from './submissions.events';
import { SUBMISSION_ROW_SELECT, type SubmissionRow } from './submission-view';
import { nextAttempt } from './submit-rules';

/** Everything about a new submission except its id and attempt number. */
export interface NewSubmission {
  userId: string;
  exerciseId: string;
  contentVersionId: string;
  sourceType: 'github_pr' | 'github_commit' | 'quiz_answers' | 'self_check' | 'link';
  status: 'submitted' | 'passed' | 'failed' | 'awaiting_review';
  sourceUrl?: string | null;
  repoFullName?: string | null;
  prNumber?: number | null;
  headSha?: string | null;
  answers?: Prisma.InputJsonValue;
  note?: string | null;
  idempotencyKey?: string | null;
}

/**
 * The only code that inserts submissions. It numbers attempts (previous max + 1) and
 * emits the domain events, so every submit endpoint behaves the same.
 */
@Injectable()
export class SubmissionWriter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async create(data: NewSubmission): Promise<SubmissionRow> {
    let row: SubmissionRow;
    try {
      row = await this.insertNextAttempt(data);
    } catch (err) {
      // Two parallel requests can read the same max attempt; the unique key
      // (user_id, exercise_id, attempt) rejects one of them, which simply tries again.
      if (!isUniqueViolation(err, 'attempt')) throw err;
      row = await this.insertNextAttempt(data);
    }
    await this.emit(row, data.userId);
    return row;
  }

  private async insertNextAttempt(data: NewSubmission): Promise<SubmissionRow> {
    const { _max } = await this.prisma.submission.aggregate({
      where: { userId: data.userId, exerciseId: data.exerciseId },
      _max: { attempt: true },
    });
    return this.prisma.submission.create({
      data: { id: newId(), attempt: nextAttempt(_max.attempt), ...data },
      select: SUBMISSION_ROW_SELECT,
    });
  }

  private async emit(row: SubmissionRow, userId: string): Promise<void> {
    const event: SubmissionEvent = {
      submissionId: row.id,
      userId,
      exerciseId: row.exerciseId,
      status: row.status,
    };
    await this.events.emitAsync(SubmissionEvents.Created, event);
    if (row.status === 'passed') await this.events.emitAsync(SubmissionEvents.Passed, event);
    if (row.status === 'awaiting_review') {
      await this.events.emitAsync(SubmissionEvents.AwaitingReview, event);
    }
  }
}
