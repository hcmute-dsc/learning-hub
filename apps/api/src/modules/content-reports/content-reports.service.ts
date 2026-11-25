import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CONTENT_REPORT_STATUSES,
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
  assertStatusChange,
  assertUnderDailyLimit,
  canHandleContentReports,
  closedAtAfter,
  dailyLimitSince,
  isGithubRepo,
  issueContent,
  notifiesReporter,
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
    const now = this.clock.now();
    const sent = await this.prisma.contentReport.count({
      where: { reporterId: user.id, createdAt: { gte: dailyLimitSince(now) } },
    });
    assertUnderDailyLimit(sent);

    const target = await this.resolve(input.target);
    const id = newId();
    await this.prisma.contentReport.create({
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
    return { id };
  }

  async list(viewer: AuthUser, query: ContentReportQuery): Promise<ContentReportList> {
    this.assertStaff(viewer);
    const tracks = await this.catalog.activeTracks();
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
      options: { tracks },
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
    const from = report.status as ContentReportStatus;
    const to = input.status ?? from;
    if (input.status !== undefined) assertStatusChange(from, to);

    // Only the row we read is changed: a parallel change of the status makes this a 409
    // instead of a second notification to the reporter.
    const { count } = await this.prisma.contentReport.updateMany({
      where: { id, status: from },
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
    if (count === 0) throw DomainError.conflict('Báo cáo vừa được người khác đổi. Tải lại trang.');

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

  /** "Tạo issue trên GitHub": one issue per report, in the repo of the report's track. */
  async createIssue(viewer: AuthUser, id: string): Promise<{ url: string }> {
    this.assertStaff(viewer);
    const report = await this.prisma.contentReport.findUnique({
      where: { id },
      include: ROW_INCLUDE,
    });
    if (!report) throw DomainError.notFound('Content report');
    if (report.githubIssueUrl) {
      throw DomainError.conflict('Báo cáo này đã có issue trên GitHub.');
    }
    const { source } = await this.catalog.trackSource(report.trackId);
    if (!isGithubRepo(source.repo)) {
      throw new DomainError(
        'VALIDATION_FAILED',
        422,
        'Nội dung của track này không nằm trên GitHub (bản chạy thử trên máy).',
      );
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
      commitSha: report.commitSha,
      repo: source.repo,
    });
    const { url } = await this.issues.createIssue(source.repo, issue);

    // Keep the first link if two staff clicked at once; GitHub then has two issues, which a
    // person can close by hand, but the hub never forgets the one it saved.
    await this.prisma.contentReport.updateMany({
      where: { id, githubIssueUrl: null },
      data: { githubIssueUrl: url },
    });
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
