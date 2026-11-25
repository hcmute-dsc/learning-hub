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
const SEEN = new Date('2026-11-25T04:00:00Z');
const SHA = 'b'.repeat(40);
const LESSON = '00000000-0000-7000-8000-000000000001';
const REPORT = '00000000-0000-7000-8000-0000000000aa';
const ISSUE = 'https://github.com/hcmute-dsc/learning-hub-track-sql/issues/7';

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
    githubIssueRequestedAt: null,
    createdAt: SEEN,
    updatedAt: SEEN,
    closedAt: null,
    track: { slug: 'sql', title: 'SQL 30 ngày' },
    reporter: { githubLogin: 'an' },
    handler: null,
    ...over,
  };
}

/**
 * Reports kept in memory, and the advisory lock as a real queue: a second transaction of the
 * same member waits until the first one ends, like pg_advisory_xact_lock.
 */
function fakeReportsTable(existing: number) {
  const rows: { reporterId: string }[] = Array.from({ length: existing }, () => ({
    reporterId: 'an',
  }));
  let lockTail: Promise<void> = Promise.resolve();
  const contentReport = {
    count: jest.fn(async () => rows.length),
    create: jest.fn(async ({ data }: { data: { reporterId: string } }) => {
      await new Promise((r) => setTimeout(r, 5)); // the insert takes a moment
      rows.push(data);
      return data;
    }),
  };
  const $transaction = jest.fn(async (fn: (tx: unknown) => Promise<void>) => {
    let release!: () => void;
    const tx = {
      contentReport,
      $executeRaw: jest.fn(async () => {
        const previous = lockTail;
        lockTail = new Promise<void>((r) => (release = r));
        await previous;
        return 1;
      }),
    };
    try {
      await fn(tx);
    } finally {
      release?.();
    }
  });
  return { rows, contentReport, $transaction };
}

function setup(opts: { sentToday?: number; report?: ReturnType<typeof stored> | null } = {}) {
  const report = opts.report === undefined ? stored() : opts.report;
  const table = fakeReportsTable(opts.sentToday ?? 0);
  const prisma = {
    $transaction: table.$transaction,
    track: {
      findMany: jest.fn().mockResolvedValue([
        { slug: 'sql', title: 'SQL 30 ngày', status: 'active' },
        { slug: 'old', title: 'Cũ', status: 'archived' },
      ]),
    },
    contentReport: {
      ...table.contentReport,
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
  };
  const emitted: [string, unknown][] = [];
  const events = {
    emitAsync: jest.fn(async (name: string, e: unknown) => emitted.push([name, e])),
  };
  const issues = {
    enabled: true,
    createIssue: jest.fn().mockResolvedValue({ url: ISSUE }),
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
  return { service, prisma, catalog, emitted, issues, rows: table.rows };
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
const seen = SEEN.toISOString();

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

  it('stops the 11th report in 24 hours with 429', async () => {
    const { service, prisma } = setup({ sentToday: 10 });
    expect((await errorOf(service.create(user('an'), input))).status).toBe(429);
    expect(prisma.contentReport.create).not.toHaveBeenCalled();
  });

  it('saves exactly one of two parallel reports sent at 9 (the count runs under a lock)', async () => {
    const { service, rows } = setup({ sentToday: 9 });
    const results = await Promise.allSettled([
      service.create(user('an'), input),
      service.create(user('an'), input),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason.status).toBe(429);
    expect(rows).toHaveLength(10);
  });

  it('answers 404 for a lesson that is not published', async () => {
    const { service, catalog } = setup();
    catalog.lesson.mockRejectedValue(DomainError.notFound('Lesson'));
    expect((await errorOf(service.create(user('an'), input))).status).toBe(404);
  });
});

describe('ContentReportsService access', () => {
  it('lets admins and mentors list (archived tracks too) and count', async () => {
    const { service } = setup();
    const list = await service.list(user('m', 'mentor'), {});
    expect(list).toMatchObject({
      counts: { open: 2, in_progress: 0, resolved: 0, dismissed: 0 },
      canCreateIssues: true,
    });
    expect(list.options.tracks).toEqual([
      { slug: 'sql', title: 'SQL 30 ngày', archived: false },
      { slug: 'old', title: 'Cũ', archived: true },
    ]);
    await expect(service.counts(user('a', 'admin'), 'sql')).resolves.toMatchObject({ open: 2 });
  });

  it('blocks members with 403 on every staff action', async () => {
    const { service, prisma } = setup();
    const member = user('an');
    expect((await errorOf(service.list(member, {}))).status).toBe(403);
    expect((await errorOf(service.counts(member))).status).toBe(403);
    expect(
      (await errorOf(service.update(member, REPORT, { status: 'resolved', updatedAt: seen })))
        .status,
    ).toBe(403);
    expect((await errorOf(service.createIssue(member, REPORT))).status).toBe(403);
    expect(prisma.contentReport.findUnique).not.toHaveBeenCalled();
  });
});

describe('ContentReportsService.update', () => {
  it('closes the version the staff saw, records who did it, and notifies the reporter', async () => {
    const { service, prisma, emitted } = setup();
    await service.update(user('m', 'mentor'), REPORT, {
      status: 'resolved',
      staffNote: 'Đã sửa',
      updatedAt: seen,
    });
    expect(prisma.contentReport.updateMany).toHaveBeenCalledWith({
      where: { id: REPORT, status: 'open', updatedAt: SEEN },
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
    await service.update(user('m', 'mentor'), REPORT, { staffNote: '', updatedAt: seen });
    expect(prisma.contentReport.updateMany).toHaveBeenCalledWith({
      where: { id: REPORT, status: 'open', updatedAt: SEEN },
      data: { staffNote: null },
    });
    expect(emitted).toEqual([]);
  });

  it('refuses a note on a version someone else already changed with 409', async () => {
    const { service, prisma } = setup();
    const older = new Date(SEEN.getTime() - 60_000).toISOString();
    const err = await errorOf(
      service.update(user('m', 'mentor'), REPORT, { staffNote: 'x', updatedAt: older }),
    );
    expect(err.status).toBe(409);
    expect(prisma.contentReport.updateMany).not.toHaveBeenCalled();
  });

  it('refuses a change the rules do not allow, and a parallel change, with 409', async () => {
    const closed = setup({ report: stored({ status: 'resolved', closedAt: NOW }) });
    const err = await errorOf(
      closed.service.update(user('m', 'mentor'), REPORT, {
        status: 'dismissed',
        updatedAt: seen,
      }),
    );
    expect(err.status).toBe(409);

    const raced = setup();
    raced.prisma.contentReport.updateMany.mockResolvedValue({ count: 0 });
    const racedErr = await errorOf(
      raced.service.update(user('m', 'mentor'), REPORT, { status: 'resolved', updatedAt: seen }),
    );
    expect(racedErr.status).toBe(409);
    expect(raced.emitted).toEqual([]);
  });

  it('does not notify a mentor about their own report', async () => {
    const { service, emitted } = setup({ report: stored({ reporterId: 'm' }) });
    await service.update(user('m', 'mentor'), REPORT, { status: 'dismissed', updatedAt: seen });
    expect(emitted[0][1]).toMatchObject({ notifyReporter: false });
  });

  it('answers 404 for an unknown report', async () => {
    const { service } = setup({ report: null });
    const err = await errorOf(
      service.update(user('m', 'mentor'), REPORT, { status: 'resolved', updatedAt: seen }),
    );
    expect(err.status).toBe(404);
  });
});

describe('ContentReportsService.createIssue', () => {
  it('claims the report, opens one issue without the reporter, then saves its link', async () => {
    const { service, issues, prisma, emitted } = setup();
    await expect(service.createIssue(user('m', 'mentor'), REPORT)).resolves.toEqual({ url: ISSUE });

    const [claim, save] = prisma.contentReport.updateMany.mock.calls.map((c) => c[0]);
    expect(claim).toEqual({
      where: {
        id: REPORT,
        githubIssueUrl: null,
        status: { in: ['open', 'in_progress'] },
        OR: [
          { githubIssueRequestedAt: null },
          { githubIssueRequestedAt: { lt: new Date('2026-11-25T04:55:00Z') } },
        ],
      },
      data: { githubIssueRequestedAt: NOW },
    });
    expect(save).toEqual({
      where: { id: REPORT, githubIssueUrl: null, githubIssueRequestedAt: NOW },
      data: { githubIssueUrl: ISSUE, githubIssueRequestedAt: null },
    });
    const [repo, issue] = issues.createIssue.mock.calls[0];
    expect(repo).toBe('hcmute-dsc/learning-hub-track-sql');
    expect(issue.body).toContain(`https://learn.example/lessons/${LESSON}`);
    expect(issue.body).not.toContain('@an');
    expect(emitted[0]).toEqual([
      ContentReportEvents.IssueCreated,
      expect.objectContaining({ actorId: 'm', issueUrl: ISSUE }),
    ]);
  });

  it('makes one issue when two staff click at once: the second claim finds nothing', async () => {
    const { service, issues, prisma } = setup();
    let claimed = false;
    prisma.contentReport.updateMany.mockImplementation(async (args: { data: object }) => {
      if (!('githubIssueRequestedAt' in args.data) || 'githubIssueUrl' in args.data) {
        return { count: 1 };
      }
      if (claimed) return { count: 0 };
      claimed = true;
      return { count: 1 };
    });
    const results = await Promise.allSettled([
      service.createIssue(user('m', 'mentor'), REPORT),
      service.createIssue(user('a', 'admin'), REPORT),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason.status).toBe(409);
    expect(issues.createIssue).toHaveBeenCalledTimes(1);
  });

  it('releases its claim when GitHub fails, so the next click can try again', async () => {
    const { service, issues, prisma, emitted } = setup();
    issues.createIssue.mockRejectedValue(new DomainError('UPSTREAM_ERROR', 502, 'GitHub'));
    expect((await errorOf(service.createIssue(user('m', 'mentor'), REPORT))).status).toBe(502);
    expect(prisma.contentReport.updateMany).toHaveBeenLastCalledWith({
      where: { id: REPORT, githubIssueRequestedAt: NOW },
      data: { githubIssueRequestedAt: null },
    });
    expect(emitted).toEqual([]);
  });

  it('reports a 409 (and no audit event) when the link could not be saved', async () => {
    const { service, prisma, emitted } = setup();
    prisma.contentReport.updateMany
      .mockResolvedValueOnce({ count: 1 }) // claim
      .mockResolvedValueOnce({ count: 0 }); // save: the claim was taken over
    expect((await errorOf(service.createIssue(user('m', 'mentor'), REPORT))).status).toBe(409);
    expect(emitted).toEqual([]);
  });

  it('refuses a second issue, and an issue for a closed report, with 409', async () => {
    const withIssue = setup({ report: stored({ githubIssueUrl: 'https://x/1' }) });
    expect((await errorOf(withIssue.service.createIssue(user('m', 'mentor'), REPORT))).status).toBe(
      409,
    );
    const closed = setup({ report: stored({ status: 'dismissed', closedAt: NOW }) });
    expect((await errorOf(closed.service.createIssue(user('m', 'mentor'), REPORT))).status).toBe(
      409,
    );
    expect(withIssue.issues.createIssue).not.toHaveBeenCalled();
    expect(closed.issues.createIssue).not.toHaveBeenCalled();
  });

  it('refuses content that is not on GitHub (local development) with 422', async () => {
    const { service, catalog } = setup();
    catalog.trackSource.mockResolvedValue({
      source: { repo: 'local:content-example', commitSha: SHA },
    });
    expect((await errorOf(service.createIssue(user('m', 'mentor'), REPORT))).status).toBe(422);
  });
});
