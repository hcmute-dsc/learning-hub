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
    // mentor-sql has an active assignment on this track; mentor-git on another one
    mentorsTrack: jest.fn(async (userId: string, trackId: string) => {
      return userId === 'mentor-sql' && trackId === SQL.id;
    }),
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
  it('lets an admin see any track without looking at assignments', async () => {
    const { service, repo } = setup();
    const stats = await service.stats(user('admin-1', 'admin'), SQL.slug);
    expect(stats.track).toEqual({ slug: SQL.slug, title: SQL.title });
    expect(repo.mentorsTrack).not.toHaveBeenCalled();
    await expect(service.access(user('admin-1', 'admin'), SQL.slug)).resolves.toEqual({
      allowed: true,
    });
  });

  it('lets a mentor of this track in', async () => {
    const { service, repo } = setup();
    await expect(service.stats(user('mentor-sql', 'mentor'), SQL.slug)).resolves.toMatchObject({
      track: { slug: SQL.slug },
    });
    expect(repo.mentorsTrack).toHaveBeenCalledWith('mentor-sql', SQL.id);
    await expect(service.access(user('mentor-sql', 'mentor'), SQL.slug)).resolves.toEqual({
      allowed: true,
    });
  });

  it('blocks a mentor of another track with 403, before reading any numbers', async () => {
    const { service, reports } = setup();
    const err = await errorOf(service.stats(user('mentor-git', 'mentor'), SQL.slug));
    expect(err).toBeInstanceOf(DomainError);
    expect(err.status).toBe(403);
    expect(reports.memberFacts).not.toHaveBeenCalled();
    await expect(service.access(user('mentor-git', 'mentor'), SQL.slug)).resolves.toEqual({
      allowed: false,
    });
  });

  it('blocks a member even if a mentor_assignments row names them as mentor', async () => {
    // The controller's @Roles('mentor') already stops members (reports.module.spec.ts);
    // the service does not rely on that alone.
    const { service, repo } = setup();
    repo.mentorsTrack.mockResolvedValue(true);
    const err = await errorOf(service.stats(user('mentor-sql'), SQL.slug));
    expect(err.status).toBe(403);
  });

  it('answers 404 for an unknown slug', async () => {
    const { service } = setup();
    const err = await errorOf(service.stats(user('admin-1', 'admin'), 'khong-co'));
    expect(err.status).toBe(404);
    expect((await errorOf(service.access(user('mentor-sql', 'mentor'), 'khong-co'))).status).toBe(
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
