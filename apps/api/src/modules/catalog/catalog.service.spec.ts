import { DomainError } from '../../common/errors';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CatalogService } from './catalog.service';

/**
 * The service only queries and hands rows to the mappers (catalog-views.spec.ts covers
 * those). These tests check the queries: what is filtered, which version is read, and paging.
 */
function fakePrisma(rows: {
  track?: unknown;
  published?: unknown;
  tracks?: unknown[];
  total?: number;
}) {
  const prisma = {
    track: {
      findUnique: jest.fn().mockResolvedValue(rows.track ?? null),
      count: jest.fn().mockResolvedValue(rows.total ?? 0),
      findMany: jest.fn().mockResolvedValue(rows.tracks ?? []),
    },
    contentVersion: { findFirst: jest.fn().mockResolvedValue(rows.published ?? null) },
    $transaction: jest.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
  };
  return { prisma, service: new CatalogService(prisma as unknown as PrismaService) };
}

const trackRow = {
  id: 't1',
  slug: 'sql-30-days',
  title: 'SQL 30 ngày',
  summary: null,
  level: 'beginner',
  language: 'vi',
  estHours: 60,
  tags: [],
  starterRepo: null,
  sourcePath: 'tracks/sql-30-days',
  status: 'active',
  contentVersion: { sourceRepo: 'hcmute-dsc/learning-hub-content', commitSha: 'ea5de5c' },
  modules: [],
};

describe('CatalogService.getTrack', () => {
  it('reads the published version for the source commit (learning-hub#8)', async () => {
    const { prisma, service } = fakePrisma({
      track: trackRow,
      published: { sourceRepo: 'hcmute-dsc/learning-hub-content', commitSha: '95a1924' },
    });
    const detail = await service.getTrack('sql-30-days');
    expect(prisma.contentVersion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'published' } }),
    );
    expect(detail.source.commitSha).toBe('95a1924');
  });

  it('asks only for active modules, lessons and exercises, in position order', async () => {
    const { prisma, service } = fakePrisma({ track: trackRow });
    await service.getTrack('sql-30-days');
    const { include } = prisma.track.findUnique.mock.calls[0][0];
    expect(include.modules.where).toEqual({ status: 'active' });
    expect(include.modules.orderBy).toEqual({ position: 'asc' });
    expect(include.modules.include.lessons.where).toEqual({ status: 'active' });
    expect(include.modules.include.exercises.where).toEqual({ status: 'active' });
  });

  it.each([
    ['missing', null],
    ['archived', { ...trackRow, status: 'archived' }],
  ])('is not found when the track is %s', async (_, track) => {
    const { prisma, service } = fakePrisma({ track });
    await expect(service.getTrack('sql-30-days')).rejects.toBeInstanceOf(DomainError);
    expect(prisma.contentVersion.findFirst).not.toHaveBeenCalled();
  });
});

describe('CatalogService.listTracks', () => {
  const query = { page: 2, pageSize: 10 } as const;

  it('pages with skip/take and returns the total', async () => {
    const { prisma, service } = fakePrisma({
      total: 11,
      tracks: [{ ...trackRow, modules: [{ _count: { lessons: 2, exercises: 3 } }] }],
    });
    const page = await service.listTracks(query);
    const args = prisma.track.findMany.mock.calls[0][0];
    expect(args.skip).toBe(10);
    expect(args.take).toBe(10);
    expect(page.page).toEqual({ page: 2, pageSize: 10, total: 11 });
    expect(page.data[0]).toMatchObject({ lessonCount: 2, exerciseCount: 3 });
  });

  it('lists active tracks only, and applies level, tag and search filters', async () => {
    const { prisma, service } = fakePrisma({});
    await service.listTracks({ ...query, level: 'beginner', tag: 'sql', q: 'join' });
    const { where } = prisma.track.findMany.mock.calls[0][0];
    expect(where).toMatchObject({ status: 'active', level: 'beginner', tags: { has: 'sql' } });
    expect(where.OR).toEqual([
      { title: { contains: 'join', mode: 'insensitive' } },
      { summary: { contains: 'join', mode: 'insensitive' } },
    ]);
    expect(prisma.track.count).toHaveBeenCalledWith({ where });
  });

  it('adds no filter for parameters that are not given', async () => {
    const { prisma, service } = fakePrisma({});
    await service.listTracks(query);
    expect(prisma.track.findMany.mock.calls[0][0].where).toEqual({ status: 'active' });
  });
});
