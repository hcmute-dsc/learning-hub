import type { UserRef } from '@hub/shared';
import type { Clock } from '../../infrastructure/clock';
import type { Env } from '../../infrastructure/config/env';
import { DomainError } from '../../common/errors';
import type { LeaderboardRepository } from './leaderboard.repository';
import { LeaderboardService } from './leaderboard.service';
import type { MemberCounts } from './ranking';
import { termById } from './term';

const ref = (id: string): UserRef => ({ id, githubLogin: id, displayName: id, avatarUrl: null });

function setup(counts: MemberCounts[], optedIn: boolean) {
  const repo = {
    countsBetween: jest.fn().mockResolvedValue(counts),
    optedIn: jest.fn().mockResolvedValue(optedIn),
    trackBySlug: jest.fn(async (slug: string) =>
      slug === 'sql-30-days' ? { id: 'track-1', slug, title: 'SQL 30 ngày' } : null,
    ),
  };
  const clock: Clock = { now: () => new Date('2026-11-21T05:00:00Z') };
  const env = { LEADERBOARD_WEIGHT_GRADED: 3, LEADERBOARD_WEIGHT_SELF_CHECK: 1 } as Env;
  const service = new LeaderboardService(repo as unknown as LeaderboardRepository, clock, env);
  return { service, repo };
}

describe('LeaderboardService', () => {
  it('counts the current term and returns the viewer row when they opted in', async () => {
    const { service, repo } = setup([{ user: ref('me'), graded: 1, selfCheck: 2 }], true);
    const board = await service.forViewer('me');

    const hk1 = termById('2026-1')!;
    expect(repo.countsBetween).toHaveBeenCalledWith(hk1.startsAt, hk1.endsAt, undefined);
    expect(board.range).toMatchObject({
      period: 'term',
      id: '2026-1',
      previousId: '2025-3',
      nextId: null,
    });
    expect(board.track).toBeNull();
    expect(board.optedIn).toBe(true);
    expect(board.me).toMatchObject({ rank: 1, score: 5, completed: 3 });
    expect(board.weights).toEqual({ graded: 3, selfCheck: 1 });
  });

  it('shows the board but no own row to a member who has not opted in', async () => {
    // the repository only returns opted-in members, so the viewer is not among them
    const { service } = setup([{ user: ref('other'), graded: 1, selfCheck: 0 }], false);
    const board = await service.forViewer('me');
    expect(board.optedIn).toBe(false);
    expect(board.me).toBeNull();
    expect(board.top).toHaveLength(1);
  });

  it('opens a past term with a link to the next one', async () => {
    const { service } = setup([], true);
    const board = await service.forViewer('me', { term: '2025-3' });
    expect(board.range).toMatchObject({ id: '2025-3', nextId: '2026-1' });
    expect(board.top).toEqual([]);
  });

  it('refuses a future term', async () => {
    const { service } = setup([], true);
    await expect(service.forViewer('me', { term: '2027-1' })).rejects.toBeInstanceOf(DomainError);
  });

  it('counts one week (Monday → Monday, Vietnam time) for period=week (learning-hub#88)', async () => {
    const { service, repo } = setup([], true);
    const board = await service.forViewer('me', { period: 'week' });
    // 21/11/2026 is a Saturday: the current week is W47 (16/11 → 23/11)
    expect(board.range).toMatchObject({
      period: 'week',
      id: '2026-W47',
      label: 'Tuần 47 (16/11 – 22/11/2026)',
      previousId: '2026-W46',
      nextId: null,
    });
    expect(repo.countsBetween).toHaveBeenCalledWith(
      new Date('2026-11-15T17:00:00Z'),
      new Date('2026-11-22T17:00:00Z'),
      undefined,
    );
    const past = await service.forViewer('me', { period: 'week', week: '2026-W45' });
    expect(past.range).toMatchObject({ id: '2026-W45', nextId: '2026-W46' });
    await expect(
      service.forViewer('me', { period: 'week', week: '2026-W48' }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('counts only one track when asked, and refuses an unknown track', async () => {
    const { service, repo } = setup([], true);
    const board = await service.forViewer('me', { track: 'sql-30-days' });
    expect(board.track).toEqual({ slug: 'sql-30-days', title: 'SQL 30 ngày' });
    expect(repo.countsBetween).toHaveBeenCalledWith(expect.any(Date), expect.any(Date), 'track-1');
    await expect(service.forViewer('me', { track: 'nope' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
