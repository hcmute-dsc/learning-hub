import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CONTENT_REPORT_STATUSES,
  isGithubRepo,
  type ContentReportCategory,
  type ContentReportCounts,
  type ContentReportList,
  type ContentReportQuery,
  type ContentReportRow,
  type ContentReportStatus,
  type ContentReportTarget,
  type CreateContentReportInput,
  type UpdateContentReportInput,
} from '@hub/shared';
import type { AuthUser } from '../../common/auth.decorators';
import { DomainError } from '../../common/errors';
import { Clock } from '../../infrastructure/clock';
import { ENV, type Env } from '../../infrastructure/config/env';
import { newId } from '../../infrastructure/ids';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CatalogReader } from '../catalog/catalog.reader';
import { CatalogService } from '../catalog/catalog.service';
import {
  assertCanCreateIssue,
  assertStatusChange,
  assertUnderDailyLimit,
  canHandleContentReports,
  closedAtAfter,
  dailyLimitSince,
  issueClaimCutoff,
  issueContent,
  notifiesReporter,
  staffReportsPath,
  storedCommit,
  targetLink,
  TRACK_PAGE_LABEL,
} from './content-report-rules';
import {
  ContentReportEvents,
  type ContentReportIssueCreatedEvent,
  type ContentReportStatusChangedEvent,
} from './content-reports.events';
import { ISSUE_TRACKER, type IssueTracker } from './ports/issue-tracker';

const staleReport = () =>
  DomainError.conflict('Báo cáo vừa được người khác đổi. Tải lại trang rồi làm lại.');

/** Rows on the staff page; older ones stay reachable through the filters. */
const LIST_LIMIT = 200;

/** What the member was reading, resolved on the server (the browser only sends ids). */
interface ResolvedTarget {
  trackId: string;
  ref: string;
  title: string;
  commitSha: string | null;
}

const ROW_INCLUDE = {
  track: { select: { slug: true, title: true } },
  reporter: { select: { githubLogin: true } },
  handler: { select: { githubLogin: true } },
} as const;

/**
 * "Báo lỗi nội dung" (learning-hub#121): members send reports from content pages; admins and
 * mentors list them, change their status, keep a note and open an issue in the track repo.
 */
@Injectable()
export class ContentReportsService {
  private readonly logger = new Logger(ContentReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogReader,
    private readonly catalogPages: CatalogService,
    private readonly clock: Clock,
    private readonly events: EventEmitter2,
    @Inject(ISSUE_TRACKER) private readonly issues: IssueTracker,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async create(user: AuthUser, input: CreateContentReportInput): Promise<{ id: string }> {
    const target = await this.resolve(input.target);
    const id = newId();
    await this.prisma.$transaction(async (tx) => {
      // One member's reports are counted and written one at a time: without the lock, ten
      // parallel requests could all count 9 and all be saved. The lock ends with the
      // transaction and never blocks other members.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${user.id}, 0))`;
      const sent = await tx.contentReport.count({
        where: { reporterId: user.id, createdAt: { gte: dailyLimitSince(this.clock.now()) } },
      });
      assertUnderDailyLimit(sent);
      await tx.contentReport.create({
        data: {
          id,
          reporterId: user.id,
          trackId: target.trackId,
          targetKind: input.target.kind,
          targetRef: target.ref,
          targetTitle: target.title,
          commitSha: target.commitSha,
          category: input.category,
          description: input.description,
          quote: input.quote ?? null,
        },
      });
    });
    return { id };
  }

  async list(viewer: AuthUser, query: ContentReportQuery): Promise<ContentReportList> {
    this.assertStaff(viewer);
    // Archived tracks too: their reports stay on the list and must stay reachable.
    const tracks = await this.prisma.track.findMany({
      orderBy: [{ status: 'asc' }, { position: 'asc' }, { title: 'asc' }],
      select: { slug: true, title: true, status: true },
    });
    const trackWhere = query.track ? { track: { slug: query.track } } : {};
    const [rows, counts] = await Promise.all([
      this.prisma.contentReport.findMany({
        where: { ...trackWhere, ...(query.status ? { status: query.status } : {}) },
        include: ROW_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: LIST_LIMIT,
      }),
      this.counts(viewer, query.track),
    ]);
    return {
      filters: { track: query.track ?? null, status: query.status ?? null },
      options: {
        tracks: tracks.map((t) => ({
          slug: t.slug,
          title: t.title,
          archived: t.status !== 'active',
        })),
      },
      counts,
      canCreateIssues: this.issues.enabled,
      reports: rows.map(toRow),
    };
  }

  /** Reports per status, for one track or all; the track statistics page shows `open`. */
  async counts(viewer: AuthUser, trackSlug?: string): Promise<ContentReportCounts> {
    this.assertStaff(viewer);
    const groups = await this.prisma.contentReport.groupBy({
      by: ['status'],
      where: trackSlug ? { track: { slug: trackSlug } } : {},
      _count: { _all: true },
    });
    const counts = Object.fromEntries(
      CONTENT_REPORT_STATUSES.map((s) => [s, 0]),
    ) as ContentReportCounts;
    for (const g of groups) counts[g.status as ContentReportStatus] = g._count._all;
    return counts;
  }

  async update(
    viewer: AuthUser,
    id: string,
    input: UpdateContentReportInput,
  ): Promise<ContentReportRow> {
    this.assertStaff(viewer);
    const report = await this.prisma.contentReport.findUnique({
      where: { id },
      include: ROW_INCLUDE,
    });
    if (!report) throw DomainError.notFound('Content report');
    const seen = new Date(input.updatedAt);
    if (report.updatedAt.getTime() !== seen.getTime()) throw staleReport();
    const from = report.status as ContentReportStatus;
    const to = input.status ?? from;
    if (input.status !== undefined) assertStatusChange(from, to);

    // Optimistic: only the version the staff member saw is changed. Someone else's status
    // or note change in between makes this a 409, never a silent overwrite or a second
    // notification to the reporter.
    const { count } = await this.prisma.contentReport.updateMany({
      where: { id, status: from, updatedAt: seen },
      data: {
        ...(input.status !== undefined
          ? {
              status: to,
              handledBy: viewer.id,
              closedAt: closedAtAfter(to, report.closedAt, this.clock.now()),
            }
          : {}),
        ...(input.staffNote !== undefined ? { staffNote: input.staffNote || null } : {}),
      },
    });
    if (count === 0) throw staleReport();

    if (input.status !== undefined) {
      const event: ContentReportStatusChangedEvent = {
        actorId: viewer.id,
        reportId: id,
        reporterId: report.reporterId,
        trackSlug: report.track.slug,
        from,
        to,
        notifyReporter: notifiesReporter(from, to) && report.reporterId !== viewer.id,
        targetTitle: report.targetTitle,
        targetLink: targetLink(
          report.targetKind as ContentReportTarget,
          report.targetRef,
          report.track.slug,
        ),
      };
      await this.events.emitAsync(ContentReportEvents.StatusChanged, event);
    }
    const updated = await this.prisma.contentReport.findUniqueOrThrow({
      where: { id },
      include: ROW_INCLUDE,
    });
    return toRow(updated);
  }

  /**
   * "Tạo issue trên GitHub": one issue per report, in the repo of the report's track. The
   * row is claimed before GitHub is called, so two clicks (or two staff members) make one
   * issue; the claim is cleared when GitHub fails, and expires after ISSUE_CLAIM_MINUTES in
   * case the API stopped half-way.
   */
  async createIssue(viewer: AuthUser, id: string): Promise<{ url: string }> {
    this.assertStaff(viewer);
    const report = await this.prisma.contentReport.findUnique({
      where: { id },
      include: ROW_INCLUDE,
    });
    if (!report) throw DomainError.notFound('Content report');
    assertCanCreateIssue(report.status as ContentReportStatus, report.githubIssueUrl);
    const { source } = await this.catalog.trackSource(report.trackId);
    if (!isGithubRepo(source.repo)) {
      throw new DomainError(
        'VALIDATION_FAILED',
        422,
        'Nội dung của track này không nằm trên GitHub (bản chạy thử trên máy).',
      );
    }

    const now = this.clock.now();
    const claimed = await this.prisma.contentReport.updateMany({
      where: {
        id,
        githubIssueUrl: null,
        status: { in: ['open', 'in_progress'] },
        OR: [
          { githubIssueRequestedAt: null },
          { githubIssueRequestedAt: { lt: issueClaimCutoff(now) } },
        ],
      },
      data: { githubIssueRequestedAt: now },
    });
    if (claimed.count === 0) {
      throw DomainError.conflict('Issue cho báo cáo này đang được tạo hoặc đã có. Tải lại trang.');
    }

    const link = targetLink(
      report.targetKind as ContentReportTarget,
      report.targetRef,
      report.track.slug,
    );
    const issue = issueContent({
      category: report.category as ContentReportCategory,
      description: report.description,
      quote: report.quote,
      targetTitle: report.targetTitle,
      trackTitle: report.track.title,
      pageUrl: new URL(link, this.env.WEB_ORIGIN).toString(),
      reportsUrl: new URL(staffReportsPath(report.track.slug), this.env.WEB_ORIGIN).toString(),
      commitSha: report.commitSha,
      repo: source.repo,
    });

    let url: string;
    try {
      ({ url } = await this.issues.createIssue(source.repo, issue));
    } catch (err) {
      // Let the next click try again; only our own claim is released.
      await this.prisma.contentReport
        .updateMany({
          where: { id, githubIssueRequestedAt: now },
          data: { githubIssueRequestedAt: null },
        })
        .catch((releaseErr: unknown) => {
          this.logger.error({ err: releaseErr, reportId: id }, 'Could not release the issue claim');
        });
      throw err;
    }

    let saved = 0;
    try {
      ({ count: saved } = await this.prisma.contentReport.updateMany({
        where: { id, githubIssueUrl: null, githubIssueRequestedAt: now },
        data: { githubIssueUrl: url, githubIssueRequestedAt: null },
      }));
    } catch (err) {
      // The issue exists on GitHub but the hub could not remember it: log the link so a
      // person can paste it in (the URL is public; no token or report text is logged).
      this.logger.error({ err, reportId: id, issueUrl: url }, 'GitHub issue created but not saved');
      throw err;
    }
    if (saved === 0) {
      this.logger.error(
        { reportId: id, issueUrl: url },
        'GitHub issue created after the claim expired',
      );
      throw DomainError.conflict(
        'Issue đã được tạo nhưng báo cáo vừa được người khác xử lý. Kiểm tra repo trên GitHub.',
      );
    }

    const event: ContentReportIssueCreatedEvent = {
      actorId: viewer.id,
      reportId: id,
      trackSlug: report.track.slug,
      repo: source.repo,
      issueUrl: url,
    };
    await this.events.emitAsync(ContentReportEvents.IssueCreated, event);
    return { url };
  }

  private assertStaff(viewer: AuthUser): void {
    // The controller's @Roles('mentor') already checks this; the rule does not rely on it.
    if (!canHandleContentReports(viewer.roles)) {
      throw DomainError.forbidden('Chỉ admin và mentor xử lý báo lỗi nội dung.');
    }
  }

  /** Track, title and commit of what the member was reading; 404 for anything not active. */
  private async resolve(target: CreateContentReportInput['target']): Promise<ResolvedTarget> {
    switch (target.kind) {
      case 'lesson': {
        const lesson = await this.catalog.lesson(target.id);
        return {
          trackId: lesson.track.id,
          ref: lesson.id,
          title: lesson.title,
          commitSha: storedCommit(lesson.source.commitSha),
        };
      }
      case 'exercise': {
        const exercise = await this.catalog.exercise(target.id);
        const { source } = await this.catalog.trackSource(exercise.track.id);
        return {
          trackId: exercise.track.id,
          ref: exercise.id,
          title: exercise.title,
          commitSha: storedCommit(source.commitSha),
        };
      }
      case 'track_page': {
        const [doc, outline] = await Promise.all([
          this.catalogPages.getTrackDoc(target.track, target.page),
          this.catalog.trackOutline({ slug: target.track }),
        ]);
        return {
          trackId: outline.id,
          ref: target.page,
          title: `${TRACK_PAGE_LABEL[target.page]} · ${doc.track.title}`,
          commitSha: storedCommit(doc.source.commitSha),
        };
      }
      case 'glossary': {
        const [glossary, outline] = await Promise.all([
          this.catalogPages.getTrackGlossary(target.track),
          this.catalog.trackOutline({ slug: target.track }),
        ]);
        return {
          trackId: outline.id,
          ref: 'glossary',
          title: `Từ vựng · ${glossary.track.title}`,
          commitSha: storedCommit(glossary.source.commitSha),
        };
      }
    }
  }
}

type ReportRecord = {
  id: string;
  targetKind: string;
  targetRef: string;
  targetTitle: string;
  commitSha: string | null;
  category: string;
  description: string;
  quote: string | null;
  status: string;
  staffNote: string | null;
  githubIssueUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  track: { slug: string; title: string };
  reporter: { githubLogin: string };
  handler: { githubLogin: string } | null;
};

export function toRow(r: ReportRecord): ContentReportRow {
  const kind = r.targetKind as ContentReportTarget;
  return {
    id: r.id,
    track: r.track,
    target: {
      kind,
      ref: r.targetRef,
      title: r.targetTitle,
      link: targetLink(kind, r.targetRef, r.track.slug),
    },
    commitSha: r.commitSha,
    category: r.category as ContentReportCategory,
    description: r.description,
    quote: r.quote,
    status: r.status as ContentReportStatus,
    reporter: { githubLogin: r.reporter.githubLogin },
    handledBy: r.handler ? { githubLogin: r.handler.githubLogin } : null,
    staffNote: r.staffNote,
    githubIssueUrl: r.githubIssueUrl,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
