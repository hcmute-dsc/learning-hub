/**
 * Maintainer CLI for MVP-Lite (no admin UI yet):
 *   pnpm --filter @hub/api build
 *   pnpm --filter @hub/api content:sync                 # sync HEAD of the configured source → draft
 *   pnpm --filter @hub/api content:sync -- --publish    # …and publish it
 *   pnpm --filter @hub/api content:sync -- --sha <40-hex> [--publish]
 * Runs as the system (audit actor = null). Uses the same service as the HTTP API.
 */
import '../load-env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DomainError } from '../common/errors';
import { ContentService } from '../modules/content/content.service';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<number> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const content = app.get(ContentService);
    const { version, created } = await content.sync(null, arg('--sha'));
    const summary = version.summary as {
      counts?: Record<string, number>;
      diff?: Record<string, Record<string, number>> | null;
      issues?: { path: string; message: string }[];
      issueCount?: number;
    };
    console.log(
      `${created ? 'Synced' : 'Already synced'} ${version.commitSha} → ${version.status} (${version.id})`,
    );
    console.log(`  source: ${version.sourceRepo}`);
    if (summary.counts) console.log(`  content: ${JSON.stringify(summary.counts)}`);

    if (version.status === 'rejected') {
      for (const i of summary.issues ?? []) console.error(`  ✗ ${i.path}: ${i.message}`);
      console.error(`  ${summary.issueCount ?? 0} problem(s); nothing was published.`);
      return 1;
    }
    if (summary.diff) {
      for (const [kind, d] of Object.entries(summary.diff)) {
        console.log(`  ${kind.padEnd(9)} +${d.added} ~${d.changed} -${d.removed} =${d.unchanged}`);
      }
    }
    if (process.argv.includes('--publish')) {
      if (version.status === 'published') {
        console.log('  already published');
      } else {
        const published = await content.publish(null, version.id);
        console.log(`Published ${published.commitSha} at ${published.publishedAt?.toISOString()}`);
      }
    }
    return 0;
  } catch (e) {
    if (e instanceof DomainError) {
      console.error(`✗ ${e.code}: ${e.message}`);
      for (const i of e.errors ?? []) console.error(`  ✗ ${i.path}: ${i.message}`);
      return 1;
    }
    throw e;
  } finally {
    await app.close();
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
