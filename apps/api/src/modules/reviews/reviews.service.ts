import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type {
  CompleteReviewInput,
  CompletedReview,
  OpenReview,
  ReviewPage,
  ReviewQueue,
  ReviewQueueQuery,
} from '@hub/shared';
import type { AuthUser } from '../../common/auth.decorators';
import { DomainError } from '../../common/errors';
import { Clock } from '../../infrastructure/clock';
import { ENV, type Env } from '../../infrastructure/config/env';
import { newId } from '../../infrastructure/ids';
import { isUniqueViolation } from '../../infrastructure/prisma/errors';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CatalogReader } from '../catalog/catalog.reader';
import { SubmissionReviewService } from '../submissions/submission-review.service';
import { PeopleReader } from '../users/people.reader';
import {
  assertCanClaim,
  assertCanComplete,
  assertCanRelease,
  rubricTotal,
  scoreRubric,
} from './review-rules';
import { MenteeActivity } from './mentee-activity';
import { ReviewRecords } from './review-records';
import { toOpenReview, toQueueItem, toReviewedSubmission, unknownPerson } from './review-view';
import { ReviewEvents, type ReviewClaimedEvent, type ReviewCompletedEvent } from './reviews.events';

/** The parsed body of POST /reviews/:id/complete (defaults applied by the Zod schema). */
type CompleteReview = Required<Pick<CompleteReviewInput, 'outcome' | 'summaryMd'>> &
  Pick<CompleteReviewInput, 'rubricScores'>;

/**
 * Mentor review (E7, USER-FLOWS "mentor review"): the queue, claiming a submission,
 * giving it back, and finishing with approved / changes requested. This module owns
 * the `reviews` table; the submission's status is changed by the submissions module.
 * The rules themselves are pure functions in review-rules.ts.
 */
@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly submissions: SubmissionReviewService,
    private readonly records: ReviewRecords,
    private readonly people: PeopleReader,
    private readonly catalog: CatalogReader,
    private readonly mentees: MenteeActivity,
    private readonly events: EventEmitter2,
    private readonly clock: Clock,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * The queue for one mentor: waiting submissions (filtered by track and/or member),
   * dashboard numbers for the same filter, and the choices for the filter form.
   */
  async queue(viewer: AuthUser, query: ReviewQueueQuery = {}): Promise<ReviewQueue> {
    const now = this.clock.now();
    const targetHours = this.env.REVIEW_TARGET_HOURS;
    const overdueBefore = new Date(now.getTime() - targetHours * 3_600_000);
    const [rows, counts, tracks, mentorship] = await Promise.all([
      this.submissions.awaitingReview(query),
      this.submissions.awaitingReviewCounts(query, overdueBefore),
      this.catalog.activeTracks(),
      this.mentees.forMentor(viewer.id, now),
    ]);
    const [members, open] = await Promise.all([
      this.people.byIds(rows.map((r) => r.userId)),
      this.records.openFor(rows.map((r) => r.id)),
    ]);
    const items = rows.map((row) =>
      toQueueItem({
        row,
        member: members.get(row.userId) ?? unknownPerson(row.userId),
        openReview: open.get(row.id) ?? null,
        now,
        targetHours,
      }),
    );
    return {
      targetHours,
      filters: { track: query.track ?? null, mentee: query.mentee ?? null },
      stats: {
        ...counts,
        // Rows are oldest first, so the first one has waited longest.
        oldestHoursWaiting: items[0]?.hoursWaiting ?? null,
        inactiveMentees: mentorship.inactive,
      },
      options: { tracks, mentees: mentorship.mentees },
      items,
    };
  }

  async page(viewer: AuthUser, submissionId: string): Promise<ReviewPage> {
    const { submission, exercise, rubric, earlierAttempts } =
      await this.submissions.forReview(submissionId);
    const ids = [submission.id, ...earlierAttempts.map((a) => a.id)];
    const [members, completed, open] = await Promise.all([
      this.people.byIds([submission.userId]),
      this.records.forSubmissions(ids),
      this.records.openFor([submission.id]),
    ]);
    return {
      submission: toReviewedSubmission(submission, completed.get(submission.id) ?? null),
      member: members.get(submission.userId) ?? unknownPerson(submission.userId),
      exercise: {
        id: exercise.id,
        title: exercise.title,
        statementMd: exercise.statementMd,
        rubric,
      },
      track: { slug: exercise.track.slug, title: exercise.track.title },
      earlierAttempts: earlierAttempts.map((a) =>
        toReviewedSubmission(a, completed.get(a.id) ?? null),
      ),
      openReview: open.get(submission.id) ?? null,
      canReview: viewer.id !== submission.userId,
    };
  }

  /** "Nhận review". The partial unique index settles two mentors clicking at once. */
  async claim(viewer: AuthUser, submissionId: string): Promise<OpenReview> {
    const { submission } = await this.submissions.forReview(submissionId);
    const open = (await this.records.openFor([submission.id])).get(submission.id) ?? null;
    assertCanClaim({
      viewer,
      submission,
      openReview: open ? { reviewerId: open.reviewer.id } : null,
    });

    let row;
    try {
      row = await this.prisma.review.create({
        data: { id: newId(), submissionId: submission.id, reviewerId: viewer.id },
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      throw DomainError.conflict('Một mentor khác vừa nhận review bài này.');
    }

    const event: ReviewClaimedEvent = {
      reviewId: row.id,
      submissionId: submission.id,
      reviewerId: viewer.id,
    };
    await this.events.emitAsync(ReviewEvents.Claimed, event);
    const reviewer = (await this.people.byIds([viewer.id])).get(viewer.id);
    return toOpenReview(row, reviewer ?? unknownPerson(viewer.id));
  }

  /** "Bỏ nhận": the open review is deleted (it holds no draft) and the submission is free again. */
  async release(viewer: AuthUser, reviewId: string): Promise<void> {
    const review = await this.records.findById(reviewId);
    if (!review) throw DomainError.notFound('Review');
    assertCanRelease(viewer, review);
    const deleted = await this.prisma.review.deleteMany({
      where: { id: review.id, status: 'in_progress' },
    });
    if (deleted.count === 0) throw DomainError.conflict('Review này vừa được hoàn thành.');

    const event: ReviewClaimedEvent = {
      reviewId: review.id,
      submissionId: review.submissionId,
      reviewerId: review.reviewerId,
    };
    await this.events.emitAsync(ReviewEvents.Released, event);
  }

  /**
   * "Hoàn thành review": saves the outcome, summary and rubric scores and, in the same
   * transaction, moves the submission to approved / changes_requested.
   */
  async complete(
    viewer: AuthUser,
    reviewId: string,
    input: CompleteReview,
  ): Promise<CompletedReview> {
    const review = await this.records.findById(reviewId);
    if (!review) throw DomainError.notFound('Review');
    assertCanComplete(viewer, review);

    const { rubric } = await this.submissions.forReview(review.submissionId);
    const scores = scoreRubric(rubric, input.rubricScores);
    const summaryMd = input.summaryMd.trim() || null;
    const completedAt = this.clock.now();

    const submission = await this.submissions.recordReviewOutcome(
      review.submissionId,
      input.outcome,
      async (tx) => {
        const updated = await tx.review.updateMany({
          where: { id: review.id, status: 'in_progress' },
          data: {
            status: input.outcome,
            summaryMd,
            submittedAt: completedAt,
            // No scores → the column stays NULL.
            ...(scores.length ? { rubricScores: scores as object[] } : {}),
          },
        });
        if (updated.count === 0) throw DomainError.conflict('Review này đã hoàn thành rồi.');
      },
    );

    const event: ReviewCompletedEvent = {
      reviewId: review.id,
      submissionId: review.submissionId,
      exerciseId: submission.exerciseId,
      memberId: submission.userId,
      reviewerId: viewer.id,
      outcome: input.outcome,
    };
    await this.events.emitAsync(ReviewEvents.Completed, event);

    const reviewer = (await this.people.byIds([viewer.id])).get(viewer.id);
    return {
      id: review.id,
      outcome: input.outcome,
      summaryMd,
      rubricScores: scores,
      rubricTotal: rubricTotal(scores),
      reviewer: reviewer ?? unknownPerson(viewer.id),
      completedAt: completedAt.toISOString(),
    };
  }
}
