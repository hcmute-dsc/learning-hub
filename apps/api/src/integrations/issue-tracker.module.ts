import { Module } from '@nestjs/common';
import { ENV, type Env } from '../infrastructure/config/env';
import {
  DisabledIssueTracker,
  ISSUE_TRACKER,
  type IssueTracker,
} from '../modules/content-reports/ports/issue-tracker';
import { GithubAppTokens } from './github/github-app.auth';
import { GithubIssueTracker } from './github/github-issue.tracker';

/**
 * Binds the IssueTracker port (learning-hub#121): the organization's GitHub App when
 * GITHUB_APP_CLIENT_ID and GITHUB_APP_PRIVATE_KEY are set, otherwise a tracker that says it
 * is not configured (the staff page then hides the button).
 */
@Module({
  providers: [
    {
      provide: ISSUE_TRACKER,
      inject: [ENV],
      useFactory: (env: Env): IssueTracker =>
        env.GITHUB_APP_CLIENT_ID && env.GITHUB_APP_PRIVATE_KEY
          ? new GithubIssueTracker(
              new GithubAppTokens(env.GITHUB_APP_CLIENT_ID, env.GITHUB_APP_PRIVATE_KEY),
            )
          : new DisabledIssueTracker(),
    },
  ],
  exports: [ISSUE_TRACKER],
})
export class IssueTrackerModule {}
