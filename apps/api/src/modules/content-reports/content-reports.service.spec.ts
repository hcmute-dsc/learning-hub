import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { AuthUser } from '../../common/auth.decorators';
import { DomainError } from '../../common/errors';
import type { Clock } from '../../infrastructure/clock';
import type { Env } from '../../infrastructure/config/env';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { CatalogReader } from '../catalog/catalog.reader';
import type { CatalogService } from '../catalog/catalog.service';
import { ContentReportEvents } from './content-reports.events';
import { ContentReportsService } from './content-reports.service';
import type { IssueTracker } from './ports/issue-tracker';

const NOW = new Date('2026-11-25T05:00:00Z');
const SHA = 'b'.repeat(40);
const LESSON = '00000000-0000-7000-8000-000000000001';
const REPORT = '00000000-0000-7000-8000-0000000000aa';

const user = (id: string, ...roles: AuthUser['roles']): AuthUser => ({
  id,
  githubLogin: id,
  status: 'active',
  roles: ['member', ...roles],
});

function stored(over: Record<string, unknown> = {}) {
  return {
    id: REPORT,
    reporterId: 'an',
    trackId: 't-sql',
    targetKind: 'lesson',
    targetRef: LESSON,
    targetTitle: 'SELECT cơ bản',
    commitSha: SHA,
    category: 'typo',
    description: 'Sai chính tả ở đoạn 2',
    quote: null,
    status: 'open',
    handledBy: null,
    staffNote: null,
    githubIssueUrl: null,
    createdAt: NOW,
    updatedAt: NOW,
    closedAt: null,
    track: { slug: 'sql', title: 'SQL 30 ngày' },
    reporter: { githubLogin: 'an' },
    handler: null,
    ...over,
  };
}

function setup(opts: { sentToday?: number; report?: ReturnType<typeof stored> | null } = {}) {
  const report = opts.report === undefined ? stored() : opts.report;
  const prisma = {
    contentReport: {
      count: jest.fn().mockResolvedValue(opts.sentToday ?? 0),
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(report),
      findUniqueOrThrow: jest.fn().mockResolvedValue(report),
      findMany: jest.fn().mockResolvedValue(report ? [report] : []),
      groupBy: jest.fn().mockResolvedValue([{ status: 'open', _count: { _all: 2 } }]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const catalog = {
    lesson: jest.fn().mockResolvedValue({
      id: LESSON,
      title: 'SELECT cơ bản',
      track: { id: 't-sql', slug: 'sql', title: 'SQL 30 ngày' },
      source: { repo: 'hcmute-dsc/learning-hub-track-sql', commitSha: SHA },
    }),
    trackSource: jest.fn().mockResolvedValue({
      source: { repo: 'hcmute-dsc/learning-hub-track-sql', commitSha: SHA },
    }),
    activeTracks: jest.fn().mockResolvedValue([{ slug: 'sql', title: 'SQL 30 ngày' }]),
  };
  const emitted: [string, unknown][] = [];
  const events = {
    emitAsync: jest.fn(async (name: string, e: unknown) => emitted.push([name, e])),
  };
  const issues = {
    enabled: true,
    createIssue: jest.fn().mockResolvedValue({ url: 'https://github.com/o/r/issues/7' }),
  };
  const service = new ContentReportsService(
    prisma as unknown as PrismaService,
    catalog as unknown as CatalogReader,
    {} as CatalogService,
    { now: () => NOW } as Clock,
    events as unknown as EventEmitter2,
    issues as unknown as IssueTracker,
    { WEB_ORIGIN: 'https://learn.example' } as Env,
  );
  return { service, prisma, catalog, emitted, issues };
}

async function errorOf(promise: Promise<unknown>): Promise<DomainError> {
  try {
    await promise;
  } catch (e) {
    return e as DomainError;
  }
  throw new Error('expected an error');
}

const input = {
  target: { kind: 'lesson' as const, id: LESSON },
  category: 'typo' as const,
  description: 'Sai chính tả ở đoạn 2',
};

describe('ContentReportsService.create', () => {
  it('stores the report with the track, title and commit read on the server', async () => {
    const { service, prisma } = setup();
    const { id } = await service.create(user('an'), { ...input, quote: 'SELCT' });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(prisma.contentReport.count).toHaveBeenCalledWith({
      where: { reporterId: 'an', createdAt: { gte: new Date('2026-11-24T05:00:00Z') } },
    });
    expect(prisma.contentReport.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reporterId: 'an',
        trackId: 't-sql',
        targetKind: 'lesson',
        targetRef: LESSON,
        targetTitle: 'SELECT cơ bản',
        commitSha: SHA,
        quote: 'SELCT',
      }),
    });
  });

  it('stops the 11th report in 24 hours with 429, before reading the content', async () => {
    const { service, prisma, catalog } = setup({ sentToday: 10 });
    expect((await errorOf(service.create(user('an'), input))).status).toBe(429);
    expect(catalog.lesson).not.toHaveBeenCalled();
    expect(prisma.contentReport.create).not.toHaveBeenCalled();
  });

  it('answers 404 for a lesson that is not published', async () => {
    const { service, catalog } = setup();
    catalog.lesson.mockRejectedValue(DomainError.notFound('Lesson'));
    expect((await errorOf(service.create(user('an'), input))).status).toBe(404);
  });
});

describe('ContentReportsService access', () => {
  it('lets admins and mentors list, count, update and create issues', async () => {
    const { service } = setup();
    await expect(service.list(user('m', 'mentor'), {})).resolves.toMatchObject({
      counts: { open: 2, in_progress: 0, resolved: 0, dismissed: 0 },
      canCreateIssues: true,
    });
    await expect(service.counts(user('a', 'admin'), 'sql')).resolves.toMatchObject({ open: 2 });
  });

  it('blocks members with 403 on every staff action', async () => {
    const { service, prisma } = setup();
    const member = user('an');
    expect((await errorOf(service.list(member, {}))).status).toBe(403);
    expect((await errorOf(service.counts(member))).status).toBe(403);
    expect((await errorOf(service.update(member, REPORT, { status: 'resolved' }))).status).toBe(
      403,
    );
    expect((await errorOf(service.createIssue(member, REPORT))).status).toBe(403);
    expect(prisma.contentReport.findUnique).not.toHaveBeenCalled();
  });
});

describe('ContentReportsService.update', () => {
  it('closes a report, records who did it, and asks to notify the reporter', async () => {
    const { service, prisma, emitted } = setup();
    await service.update(user('m', 'mentor'), REPORT, { status: 'resolved', staffNote: 'Đã sửa' });
    expect(prisma.contentReport.updateMany).toHaveBeenCalledWith({
      where: { id: REPORT, status: 'open' },
      data: { status: 'resolved', handledBy: 'm', closedAt: NOW, staffNote: 'Đã sửa' },
    });
    expect(emitted).toEqual([
      [
        ContentReportEvents.StatusChanged,
        expect.objectContaining({
          actorId: 'm',
          reporterId: 'an',
          from: 'open',
          to: 'resolved',
          notifyReporter: true,
          targetLink: `/lessons/${LESSON}`,
        }),
      ],
    ]);
  });

  it('saves a note alone without an event, and an empty note clears it', async () => {
    const { service, prisma, emitted } = setup();
    await service.update(user('m', 'mentor'), REPORT, { staffNote: '' });
    expect(prisma.contentReport.updateMany).toHaveBeenCalledWith({
      where: { id: REPORT, status: 'open' },
      data: { staffNote: null },
    });
    expect(emitted).toEqual([]);
  });

  it('refuses a change the rules do not allow, and a parallel change, with 409', async () => {
    const closed = setup({ report: stored({ status: 'resolved', closedAt: NOW }) });
    const err = await errorOf(
      closed.service.update(user('m', 'mentor'), REPORT, { status: 'dismissed' }),
    );
    expect(err.status).toBe(409);

    const raced = setup();
    raced.prisma.contentReport.updateMany.mockResolvedValue({ count: 0 });
    expect(
      (await errorOf(raced.service.update(user('m', 'mentor'), REPORT, { status: 'resolved' })))
        .status,
    ).toBe(409);
    expect(raced.emitted).toEqual([]);
  });

  it('does not notify a mentor about their own report', async () => {
    const { service, emitted } = setup({ report: stored({ reporterId: 'm' }) });
    await service.update(user('m', 'mentor'), REPORT, { status: 'dismissed' });
    expect(emitted[0][1]).toMatchObject({ notifyReporter: false });
  });

  it('answers 404 for an unknown report', async () => {
    const { service } = setup({ report: null });
    expect(
      (await errorOf(service.update(user('m', 'mentor'), REPORT, { status: 'resolved' }))).status,
    ).toBe(404);
  });
});

describe('ContentReportsService.createIssue', () => {
  it('opens one issue in the track repo, without the reporter, and keeps its link', async () => {
    const { service, issues, prisma, emitted } = setup();
    await expect(service.createIssue(user('m', 'mentor'), REPORT)).resolves.toEqual({
      url: 'https://github.com/o/r/issues/7',
    });
    const [repo, issue] = issues.createIssue.mock.calls[0];
    expect(repo).toBe('hcmute-dsc/learning-hub-track-sql');
    expect(issue.body).toContain(`https://learn.example/lessons/${LESSON}`);
    expect(issue.body).not.toContain('@an');
    expect(issue.body).not.toMatch(/\ban\b/);
    expect(prisma.contentReport.updateMany).toHaveBeenCalledWith({
      where: { id: REPORT, githubIssueUrl: null },
      data: { githubIssueUrl: 'https://github.com/o/r/issues/7' },
    });
    expect(emitted[0]).toEqual([
      ContentReportEvents.IssueCreated,
      expect.objectContaining({ actorId: 'm', repo: 'hcmute-dsc/learning-hub-track-sql' }),
    ]);
  });

  it('refuses a second issue for the same report with 409', async () => {
    const { service, issues } = setup({ report: stored({ githubIssueUrl: 'https://x/1' }) });
    expect((await errorOf(service.createIssue(user('m', 'mentor'), REPORT))).status).toBe(409);
    expect(issues.createIssue).not.toHaveBeenCalled();
  });

  it('refuses content that is not on GitHub (local development) with 422', async () => {
    const { service, catalog } = setup();
    catalog.trackSource.mockResolvedValue({
      source: { repo: 'local:content-example', commitSha: SHA },
    });
    expect((await errorOf(service.createIssue(user('m', 'mentor'), REPORT))).status).toBe(422);
  });
});
