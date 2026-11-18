import { DomainError } from '../../common/errors';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CatalogReader } from './catalog.reader';

/** Query-level checks; the row → result mapping is covered in catalog-views.spec.ts. */
function fakePrisma(found: unknown = null) {
  const prisma = {
    track: { findFirst: jest.fn().mockResolvedValue(found) },
    lesson: { findFirst: jest.fn().mockResolvedValue(found) },
    contentVersion: { findFirst: jest.fn().mockResolvedValue(null) },
    exercise: {
      findFirst: jest.fn().mockResolvedValue(found),
      findMany: jest.fn().mockResolvedValue([]),
    },
    exercisePrerequisite: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return { prisma, reader: new CatalogReader(prisma as unknown as PrismaService) };
}

// Archived content behaves as "not found": the item itself, its module or its track.
const ACTIVE_PATH = { status: 'active', module: { status: 'active', track: { status: 'active' } } };

describe('CatalogReader', () => {
  it('reads only active lessons inside an active module and track', async () => {
    const { prisma, reader } = fakePrisma();
    await expect(reader.lesson('l1')).rejects.toBeInstanceOf(DomainError);
    expect(prisma.lesson.findFirst.mock.calls[0][0].where).toEqual({ id: 'l1', ...ACTIVE_PATH });
  });

  it('gives a lesson the source of the published version (learning-hub#20)', async () => {
    const { prisma, reader } = fakePrisma({
      id: 'l1',
      slug: 'day-01',
      title: 'Ngày 1',
      bodyMd: '',
      estMinutes: null,
      sourcePath: 'tracks/sql/modules/01/lessons/day-01.md',
      module: { slug: 'm1', title: 'M1', track: { id: 't1', slug: 'sql', title: 'SQL' } },
      contentVersion: { sourceRepo: 'hcmute-dsc/learning-hub-content', commitSha: 'old' },
      exercises: [],
    });
    prisma.contentVersion.findFirst.mockResolvedValue({
      sourceRepo: 'hcmute-dsc/learning-hub-content',
      commitSha: 'new',
      trackSources: { sql: { repo: 'hcmute-dsc/learning-hub-track-sql', commitSha: 'abc' } },
    });
    await expect(reader.lesson('l1')).resolves.toMatchObject({
      source: { repo: 'hcmute-dsc/learning-hub-track-sql', commitSha: 'abc' },
    });
    expect(prisma.contentVersion.findFirst.mock.calls[0][0].where).toEqual({ status: 'published' });
  });

  it('reads only active exercises inside an active module and track', async () => {
    const { prisma, reader } = fakePrisma();
    await expect(reader.exercise('e1')).rejects.toBeInstanceOf(DomainError);
    expect(prisma.exercise.findFirst.mock.calls[0][0].where).toEqual({ id: 'e1', ...ACTIVE_PATH });
  });

  it('finds a track outline by id or slug, active only', async () => {
    const { prisma, reader } = fakePrisma();
    await expect(reader.trackOutline({ slug: 'git' })).rejects.toBeInstanceOf(DomainError);
    expect(prisma.track.findFirst.mock.calls[0][0].where).toEqual({
      slug: 'git',
      status: 'active',
    });
  });

  it('builds the outline in reading order', async () => {
    const { reader } = fakePrisma({
      id: 't1',
      slug: 'git',
      title: 'Git',
      modules: [
        { slug: 'a', lessons: [{ id: 'l1', title: 'L1' }], exercises: [{ id: 'e1', title: 'E1' }] },
      ],
    });
    const outline = await reader.trackOutline({ id: 't1' });
    expect(outline.items.map((i) => i.id)).toEqual(['l1', 'e1']);
  });

  it('ignores archived prerequisites when building the prerequisite map', async () => {
    const { prisma, reader } = fakePrisma();
    const map = await reader.prerequisiteMap(['e1']);
    expect(prisma.exercisePrerequisite.findMany.mock.calls[0][0].where).toEqual({
      exerciseId: { in: ['e1'] },
      requiredExercise: { status: 'active' },
    });
    expect(map.get('e1')).toEqual([]);
  });
});
