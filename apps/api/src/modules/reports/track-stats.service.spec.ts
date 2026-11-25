import type { AuthUser } from '../../common/auth.decorators';
import { DomainError } from '../../common/errors';
import type { Clock } from '../../infrastructure/clock';
import type { ReportFilter, ReportsRepository } from './reports.repository';
import type { TrackStatsRepository } from './track-stats.repository';
import { TrackStatsService } from './track-stats.service';

const NOW = new Date('2026-11-25T05:00:00Z'); // Wednesday 25/11/2026, 12:00 in Vietnam
const SQL = { id: 't-sql', slug: 'sql-30-days', title: 'SQL 30 ngày' };

const user = (id: string, ...roles: AuthUser['roles']): AuthUser => ({
  id,
  githubLogin: id,
  status: 'active',
  roles: ['member', ...roles],
});

function setup() {
  const filters: ReportFilter[] = [];
  const reports = {
    memberFacts: jest.fn(async (f: ReportFilter) => {
      filters.push(f);
      return [];
    }),
    reviewFacts: jest.fn(async () => []),
  };
  const repo = {
    trackBySlug: jest.fn(async (slug: string) => (slug === SQL.slug ? SQL : null)),
    outline: jest.fn(async () => []),
    doneItems: jest.fn(async () => []),
    firstAttempts: jest.fn(async () => []),
    waitingReviews: jest.fn(async () => []),
    activity: jest.fn(async () => []),
  };
  const clock = { now: () => NOW } as Clock;
  const service = new TrackStatsService(
    reports as unknown as ReportsRepository,
    repo as unknown as TrackStatsRepository,
    clock,
  );
  return { service, repo, reports, filters };
}

async function errorOf(promise: Promise<unknown>): Promise<DomainError> {
  try {
    await promise;
  } catch (e) {
    return e as DomainError;
  }
  throw new Error('expected an error');
}

describe('TrackStatsService access', () => {
  it('lets an admin see any track', async () => {
    const { service } = setup();
    const stats = await service.stats(user('admin-1', 'admin'), SQL.slug);
    expect(stats.track).toEqual({ slug: SQL.slug, title: SQL.title });
  });

  it('lets every mentor see every track, like the review queue (#30)', async () => {
    const { service } = setup();
    // a mentor who mostly reviews another track is still let in
    await expect(service.stats(user('mentor-git', 'mentor'), SQL.slug)).resolves.toMatchObject({
      track: { slug: SQL.slug },
    });
  });

  it('blocks a member with 403, before reading any numbers', async () => {
    // The controller's @Roles('mentor') already stops members (reports.module.spec.ts);
    // the service does not rely on that alone.
    const { service, reports } = setup();
    const err = await errorOf(service.stats(user('an'), SQL.slug));
    expect(err).toBeInstanceOf(DomainError);
    expect(err.status).toBe(403);
    expect(reports.memberFacts).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown slug', async () => {
    const { service } = setup();
    expect((await errorOf(service.stats(user('admin-1', 'admin'), 'khong-co'))).status).toBe(404);
    expect((await errorOf(service.stats(user('mentor-git', 'mentor'), 'khong-co'))).status).toBe(
      404,
    );
  });
});

describe('TrackStatsService numbers', () => {
  it('reads the report facts of this track for the last 14 Vietnam days', async () => {
    const { service, filters, repo } = setup();
    const stats = await service.stats(user('admin-1', 'admin'), SQL.slug);
    expect(stats.period).toEqual({ from: '2026-11-12', to: '2026-11-25' });
    expect(filters).toEqual([
      {
        startsAt: new Date('2026-11-11T17:00:00Z'),
        endsAt: new Date('2026-11-25T17:00:00Z'),
        trackId: SQL.id,
      },
    ]);
    // 12 weeks back from Monday 23/11: Monday 07/09, 00:00 in Vietnam
    expect(repo.activity).toHaveBeenCalledWith(SQL.id, new Date('2026-09-06T17:00:00Z'));
    expect(stats.weekly).toHaveLength(12);
    expect(stats.generatedAt).toBe(NOW.toISOString());
    expect(stats.inactive).toEqual({ total: 0, learners: [] });
  });
});
