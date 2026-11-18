import { Module } from '@nestjs/common';
import { ENV, type Env } from '../infrastructure/config/env';
import { CONTENT_SOURCE } from '../modules/content/ports/content-source';
import { SOLUTION_SOURCE, type SolutionSource } from '../modules/content/ports/solution-source';
import { GithubContentSource } from './github/github-content.source';
import { RegistryContentSource } from './github/registry-content.source';
import { LocalContentFilesController } from './local/local-content-files.controller';
import { LocalDirContentSource } from './local/local-dir-content.source';

/**
 * Binds the ContentSource port to a local folder (dev), one GitHub repo, or the registry
 * of track repos (DECISIONS ADR-10), from env. Binds the SolutionSource port to the private
 * checker repo, a local folder, or null (CONTENT-SPECIFICATION §3.8).
 * The controller serves lesson images in local mode only (see its comment).
 */
@Module({
  controllers: [LocalContentFilesController],
  providers: [
    {
      provide: CONTENT_SOURCE,
      inject: [ENV],
      useFactory: (env: Env) => {
        const { CONTENT_REPO: repo, CONTENT_BRANCH: branch, CONTENT_GITHUB_TOKEN: token } = env;
        switch (env.CONTENT_SOURCE) {
          case 'registry':
            return new RegistryContentSource(repo, branch, token);
          case 'github':
            return new GithubContentSource(repo, branch, token);
          default:
            return new LocalDirContentSource(env.CONTENT_LOCAL_DIR);
        }
      },
    },
    {
      provide: SOLUTION_SOURCE,
      inject: [ENV],
      useFactory: (env: Env): SolutionSource | null => {
        switch (env.SOLUTIONS_SOURCE) {
          case 'github':
            return new GithubContentSource(
              env.SOLUTIONS_REPO,
              env.SOLUTIONS_BRANCH,
              env.SOLUTIONS_GITHUB_TOKEN ?? env.CONTENT_GITHUB_TOKEN,
            );
          case 'local':
            return new LocalDirContentSource(env.SOLUTIONS_LOCAL_DIR, 'exercises');
          default:
            return null;
        }
      },
    },
  ],
  exports: [CONTENT_SOURCE, SOLUTION_SOURCE],
})
export class ContentSourceModule {}
