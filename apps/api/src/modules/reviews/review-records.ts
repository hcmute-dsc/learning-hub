import { Injectable } from '@nestjs/common';
import type { CompletedReview, OpenReview } from '@hub/shared';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { CompletedReviews } from '../submissions/ports/completed-reviews';
import { PeopleReader } from '../users/people.reader';
import {
  REVIEW_ROW_SELECT,
  toCompletedReview,
  toOpenReview,
  unknownPerson,
  type ReviewRow,
} from './review-view';

/**
 * Reads the `reviews` table for many submissions at once, with reviewer names. Used by
 * the review pages and, through the COMPLETED_REVIEWS port, by the submissions module
 * to show members their finished reviews.
 */
@Injectable()
export class ReviewRecords implements CompletedReviews {
  constructor(
    private readonly prisma: PrismaService,
    private readonly people: PeopleReader,
  ) {}

  /** submissionId → its finished review (newest if there were several). */
  async forSubmissions(submissionIds: string[]): Promise<Map<string, CompletedReview>> {
    if (!submissionIds.length) return new Map();
    const rows = await this.prisma.review.findMany({
      where: { submissionId: { in: submissionIds }, status: { not: 'in_progress' } },
      orderBy: { submittedAt: 'asc' },
      select: REVIEW_ROW_SELECT,
    });
    const people = await this.people.byIds(rows.map((r) => r.reviewerId));
    const result = new Map<string, CompletedReview>();
    for (const row of rows) {
      const review = toCompletedReview(
        row,
        people.get(row.reviewerId) ?? unknownPerson(row.reviewerId),
      );
      // Ascending order, so a later review of the same submission wins.
      if (review) result.set(row.submissionId, review);
    }
    return result;
  }

  /** submissionId → the review someone has claimed and not finished. */
  async openFor(submissionIds: string[]): Promise<Map<string, OpenReview>> {
    if (!submissionIds.length) return new Map();
    const rows = await this.prisma.review.findMany({
      where: { submissionId: { in: submissionIds }, status: 'in_progress' },
      select: REVIEW_ROW_SELECT,
    });
    const people = await this.people.byIds(rows.map((r) => r.reviewerId));
    return new Map(
      rows.map((row) => [
        row.submissionId,
        toOpenReview(row, people.get(row.reviewerId) ?? unknownPerson(row.reviewerId)),
      ]),
    );
  }

  async findById(reviewId: string): Promise<ReviewRow | null> {
    return this.prisma.review.findUnique({ where: { id: reviewId }, select: REVIEW_ROW_SELECT });
  }
}
