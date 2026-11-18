import { Inject, Injectable } from '@nestjs/common';
import type { AdminOverview } from '@hub/shared';
import { Clock } from '../../infrastructure/clock';
import { ENV, type Env } from '../../infrastructure/config/env';
import { AuditReader } from '../audit/audit.reader';
import { ContentService } from '../content/content.service';
import { SubmissionReviewService } from '../submissions/submission-review.service';
import { UsersService } from '../users/users.service';
import { activitySince, toOverview } from './overview';

/**
 * Numbers for the admin overview (issue #29). Each count comes from the module that
 * owns the table (CONTRIBUTING rule 1), and every query is a COUNT or a single row:
 * nothing here loads a list of people.
 */
@Injectable()
export class OverviewService {
  constructor(
    private readonly users: UsersService,
    private readonly content: ContentService,
    private readonly submissions: SubmissionReviewService,
    private readonly audit: AuditReader,
    private readonly clock: Clock,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async get(): Promise<AdminOverview> {
    const now = this.clock.now();
    const since = activitySince(now);
    const [members, content, backlog, signedIn, submissions, adminActions] = await Promise.all([
      this.users.countByStatus(),
      this.content.overviewCounts(),
      this.submissions.reviewBacklog(),
      this.users.countSignedInSince(since),
      this.submissions.countSubmittedSince(since),
      this.audit.countSince(since),
    ]);
    return toOverview(
      { members, content, backlog, signedIn, submissions, adminActions },
      now,
      this.env.REVIEW_TARGET_HOURS,
    );
  }
}
