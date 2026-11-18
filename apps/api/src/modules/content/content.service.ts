import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { parseContent, type ContentIssue, type ContentTree } from '@hub/content';
import type { ContentVersionStatus, ContentVersionSummary, ContentVersionView } from '@hub/shared';
import type { ContentVersion, Prisma } from '@prisma/client';
import { DomainError } from '../../common/errors';
import { Clock } from '../../infrastructure/clock';
import { newId } from '../../infrastructure/ids';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CatalogWriter } from '../catalog/catalog.writer';
import { UsersService } from '../users/users.service';
import {
  ContentEvents,
  type ContentPublishedEvent,
  type ContentVersionEvent,
} from './content.events';
import { planChanges, type ChangePlan } from './domain/plan';
import { publishedChanges } from './domain/published-changes';
import { CONTENT_SOURCE, loadFileMap, type ContentSource } from './ports/content-source';

const SHA = /^[0-9a-f]{40}$/;
const MAX_STORED_ISSUES = 200;

export interface VersionView {
  id: string;
  sourceRepo: string;
  commitSha: string;
  status: string;
  summary: unknown;
  createdAt: Date;
  publishedAt: Date | null;
}

const view = (v: ContentVersion): VersionView => ({
  id: v.id,
  sourceRepo: v.sourceRepo,
  commitSha: v.commitSha,
  status: v.status,
  summary: v.summary,
  createdAt: v.createdAt,
  publishedAt: v.publishedAt,
});

const counts = (tree: ContentTree) =>
  tree.tracks.reduce(
    (c, t) => {
      c.tracks += 1;
      for (const m of t.modules) {
        c.modules += 1;
        c.lessons += m.lessons.length;
        c.exercises += m.exercises.length;
      }
      return c;
    },
    { tracks: 0, modules: 0, lessons: 0, exercises: 0 },
  );

const toValidationError = (message: string, issues: ContentIssue[]) =>
  new DomainError(
    'VALIDATION_FAILED',
    422,
    message,
    issues.slice(0, MAX_STORED_ISSUES).map((i) => ({ path: i.path, message: i.message })),
  );

/**
 * Content pipeline (USER-FLOWS §10):
 *   sync    → read source at a commit, validate, record a draft (or rejected) version + diff.
 *             Does NOT touch the catalog.
 *   publish → re-read the same commit, re-validate, apply the diff in ONE transaction.
 */
@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly writer: CatalogWriter,
    private readonly clock: Clock,
    private readonly events: EventEmitter2,
    private readonly users: UsersService,
    @Inject(CONTENT_SOURCE) private readonly source: ContentSource,
  ) {}

  private async readAndPlan(sha: string, tx: Prisma.TransactionClient = this.prisma) {
    const { tree, issues } = parseContent(await loadFileMap(this.source, sha));
    let plan: ChangePlan | null = null;
    if (!issues.length) {
      plan = planChanges(tree, await this.writer.snapshot(tx));
      issues.push(...plan.conflicts);
    }
    return { tree, issues, plan };
  }

  /** Idempotent per (source repo, commit). Returns the version; `rejected` when invalid. */
  async sync(
    actorId: string | null,
    commitSha?: string,
  ): Promise<{ version: VersionView; created: boolean }> {
    const sha = commitSha ?? (await this.source.getHead()).sha;
    if (!SHA.test(sha))
      throw new DomainError('BAD_REQUEST', 400, 'commitSha must be 40 lowercase hex characters');

    const existing = await this.prisma.contentVersion.findUnique({
      where: { sourceRepo_commitSha: { sourceRepo: this.source.sourceRepo, commitSha: sha } },
    });
    if (existing) return { version: view(existing), created: false };

    const { tree, issues, plan } = await this.readAndPlan(sha);
    const status = issues.length ? 'rejected' : 'draft';
    const trackSources = await this.source.trackSources?.(sha);
    const version = await this.prisma.contentVersion.create({
      data: {
        id: newId(),
        sourceRepo: this.source.sourceRepo,
        commitSha: sha,
        status,
        syncedBy: actorId,
        ...(trackSources && { trackSources: trackSources as unknown as Prisma.InputJsonValue }),
        summary: {
          counts: counts(tree),
          diff: plan?.diff ?? null,
          issueCount: issues.length,
          issues: issues.slice(0, MAX_STORED_ISSUES),
        } as unknown as Prisma.InputJsonValue,
      },
    });
    await this.events.emitAsync(ContentEvents.Synced, {
      actorId,
      versionId: version.id,
      commitSha: sha,
      status,
    } satisfies ContentVersionEvent);
    return { version: view(version), created: true };
  }

  async publish(actorId: string | null, versionId: string): Promise<VersionView> {
    const version = await this.prisma.contentVersion.findUnique({ where: { id: versionId } });
    if (!version) throw DomainError.notFound('Content version');
    // `superseded` = it was live before: publishing it again is a rollback to that commit.
    // The diff is recomputed below against today's catalog, so this is safe.
    if (version.status !== 'draft' && version.status !== 'superseded') {
      throw DomainError.conflict(
        `Only a draft or an older (superseded) version can be published (this version is ${version.status})`,
      );
    }
    if (version.sourceRepo !== this.source.sourceRepo) {
      throw DomainError.conflict(
        `This version came from ${version.sourceRepo}, but the configured source is ${this.source.sourceRepo}`,
      );
    }

    // Read outside the transaction (network), then plan + apply inside it.
    const { tree, issues } = parseContent(await loadFileMap(this.source, version.commitSha));
    if (issues.length) throw toValidationError('Content at this commit is no longer valid', issues);

    const { published, plan, previousCommitSha } = await this.prisma.$transaction(
      async (tx) => {
        const plan = planChanges(tree, await this.writer.snapshot(tx));
        if (plan.conflicts.length)
          throw toValidationError('Content conflicts with the catalog', plan.conflicts);

        const now = this.clock.now();
        const previous = await tx.contentVersion.findFirst({
          where: { status: 'published' },
          select: { commitSha: true },
        });
        await tx.contentVersion.updateMany({
          where: { status: 'published' },
          data: { status: 'superseded' },
        });
        await this.writer.apply(tx, tree, plan, version.id);
        const published = await tx.contentVersion.update({
          where: { id: version.id },
          data: {
            status: 'published',
            publishedBy: actorId,
            publishedAt: now,
            summary: {
              ...(version.summary as object),
              counts: counts(tree),
              diff: plan.diff,
              appliedAt: now.toISOString(),
            } as unknown as Prisma.InputJsonValue,
          },
        });
        return { published, plan, previousCommitSha: previous?.commitSha ?? null };
      },
      { timeout: 60_000, maxWait: 10_000 },
    );

    await this.events.emitAsync(ContentEvents.Published, {
      actorId,
      versionId: published.id,
      commitSha: published.commitSha,
      status: published.status,
      sourceRepo: published.sourceRepo,
      previousCommitSha,
      changes: publishedChanges(tree, plan),
    } satisfies ContentPublishedEvent);
    return view(published);
  }

  async reject(actorId: string | null, versionId: string): Promise<VersionView> {
    const { count } = await this.prisma.contentVersion.updateMany({
      where: { id: versionId, status: 'draft' },
      data: { status: 'rejected' },
    });
    const version = await this.prisma.contentVersion.findUnique({ where: { id: versionId } });
    if (!version) throw DomainError.notFound('Content version');
    if (!count)
      throw DomainError.conflict(
        `Only a draft can be rejected (this version is ${version.status})`,
      );
    await this.events.emitAsync(ContentEvents.Rejected, {
      actorId,
      versionId,
      commitSha: version.commitSha,
      status: 'rejected',
    } satisfies ContentVersionEvent);
    return view(version);
  }

  async list(limit = 50): Promise<ContentVersionView[]> {
    const rows = await this.prisma.contentVersion.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return this.withActors(rows);
  }

  async get(versionId: string): Promise<ContentVersionView> {
    const v = await this.prisma.contentVersion.findUnique({ where: { id: versionId } });
    if (!v) throw DomainError.notFound('Content version');
    const [withActor] = await this.withActors([v]);
    return withActor;
  }

  /** Names of who synced/published, read through UsersService (users owns that table). */
  private async withActors(rows: ContentVersion[]): Promise<ContentVersionView[]> {
    const refs = await this.users.refsByIds(rows.flatMap((v) => [v.syncedBy, v.publishedBy]));
    return rows.map((v) => ({
      ...view(v),
      status: v.status as ContentVersionStatus,
      summary: (v.summary ?? {}) as ContentVersionSummary,
      createdAt: v.createdAt.toISOString(),
      publishedAt: v.publishedAt?.toISOString() ?? null,
      syncedBy: v.syncedBy ? (refs.get(v.syncedBy) ?? null) : null,
      publishedBy: v.publishedBy ? (refs.get(v.publishedBy) ?? null) : null,
    }));
  }
}
