import { Module } from '@nestjs/common';
import { ENV, type Env } from '../infrastructure/config/env';
import { CONTENT_SOURCE } from '../modules/content/ports/content-source';
import { GithubContentSource } from './github/github-content.source';
import { LocalDirContentSource } from './local/local-dir-content.source';

/** Binds the ContentSource port to a local folder (dev) or a GitHub repo, from env. */
@Module({
  providers: [
    {
      provide: CONTENT_SOURCE,
      inject: [ENV],
      useFactory: (env: Env) =>
        env.CONTENT_SOURCE === 'github'
          ? new GithubContentSource(env.CONTENT_REPO, env.CONTENT_BRANCH, env.CONTENT_GITHUB_TOKEN)
          : new LocalDirContentSource(env.CONTENT_LOCAL_DIR),
    },
  ],
  exports: [CONTENT_SOURCE],
})
export class ContentSourceModule {}
