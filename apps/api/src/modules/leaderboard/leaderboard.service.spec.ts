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
    expect(repo.countsBetween).toHaveBeenCalledWith(hk1.startsAt, hk1.endsAt);
    expect(board.term).toMatchObject({ id: '2026-1', previousId: '2025-3', nextId: null });
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
    const board = await service.forViewer('me', '2025-3');
    expect(board.term).toMatchObject({ id: '2025-3', nextId: '2026-1' });
    expect(board.top).toEqual([]);
  });

  it('refuses a future term', async () => {
    const { service } = setup([], true);
    await expect(service.forViewer('me', '2027-1')).rejects.toBeInstanceOf(DomainError);
  });
});
