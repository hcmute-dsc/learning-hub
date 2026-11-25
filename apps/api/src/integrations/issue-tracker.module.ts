import { Module } from '@nestjs/common';
import { ENV, type Env } from '../infrastructure/config/env';
import {
  DisabledIssueTracker,
  ISSUE_TRACKER,
  type IssueTracker,
} from '../modules/content-reports/ports/issue-tracker';
import { GithubIssueTracker } from './github/github-issue.tracker';

/**
 * Binds the IssueTracker port (learning-hub#121): GitHub when CONTENT_ISSUES_GITHUB_TOKEN is
 * set, otherwise a tracker that says it is not configured.
 */
@Module({
  providers: [
    {
      provide: ISSUE_TRACKER,
      inject: [ENV],
      useFactory: (env: Env): IssueTracker =>
        env.CONTENT_ISSUES_GITHUB_TOKEN
          ? new GithubIssueTracker(env.CONTENT_ISSUES_GITHUB_TOKEN)
          : new DisabledIssueTracker(),
    },
  ],
  exports: [ISSUE_TRACKER],
})
export class IssueTrackerModule {}
