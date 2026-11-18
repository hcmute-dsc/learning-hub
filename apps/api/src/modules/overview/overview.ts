import type { AdminOverview, UserStatus } from '@hub/shared';
import { waitingTime } from '../reviews/review-rules';

/** Pure helpers for GET /admin/overview (tested in overview.spec.ts). */

/** How far back the "Hoạt động" card looks. */
export const ACTIVITY_DAYS = 7;

/** Start of the activity window: exactly `days` × 24 hours before now. */
export function activitySince(now: Date, days: number = ACTIVITY_DAYS): Date {
  return new Date(now.getTime() - days * 24 * 3_600_000);
}

/** The counts as the owning modules return them. */
export interface OverviewFacts {
  members: Record<UserStatus, number>;
  content: {
    published: { id: string; commitSha: string; publishedAt: Date | null } | null;
    drafts: number;
  };
  backlog: { waiting: number; oldestSubmittedAt: Date | null };
  signedIn: number;
  submissions: number;
  adminActions: number;
}

/** Turns the facts into the API shape; the oldest wait uses the same rule as the review queue. */
export function toOverview(facts: OverviewFacts, now: Date, targetHours: number): AdminOverview {
  const { published, drafts } = facts.content;
  const oldestAt = facts.backlog.oldestSubmittedAt;
  return {
    members: { ...facts.members },
    content: {
      published: published
        ? {
            id: published.id,
            commitSha: published.commitSha,
            publishedAt: published.publishedAt?.toISOString() ?? null,
          }
        : null,
      drafts,
    },
    reviews: {
      waiting: facts.backlog.waiting,
      oldest: oldestAt
        ? { submittedAt: oldestAt.toISOString(), ...waitingTime(oldestAt, now, targetHours) }
        : null,
      targetHours,
    },
    activity: {
      days: ACTIVITY_DAYS,
      signedIn: facts.signedIn,
      submissions: facts.submissions,
      adminActions: facts.adminActions,
    },
  };
}
