import type { UserRef } from '@hub/shared';
import { rank, scoreOf, topAndMe, type MemberCounts } from './ranking';

const user = (id: string, displayName = id): UserRef => ({
  id,
  githubLogin: id,
  displayName,
  avatarUrl: null,
});
const member = (id: string, graded: number, selfCheck: number, name?: string): MemberCounts => ({
  user: user(id, name),
  graded,
  selfCheck,
});
const W = { graded: 3, selfCheck: 1 };

/** Scoring and ranking rules of ADR-08 (ranking.ts). */
describe('leaderboard ranking', () => {
  it('weighs self_check lower than graded or reviewed exercises', () => {
    expect(scoreOf({ graded: 2, selfCheck: 3 }, W)).toBe(9);
    expect(scoreOf({ graded: 0, selfCheck: 1 }, W)).toBeLessThan(
      scoreOf({ graded: 1, selfCheck: 0 }, W),
    );
  });

  it('orders by score with a dense rank: equal scores share a rank', () => {
    const rows = rank(
      [member('a', 1, 0), member('b', 2, 0), member('c', 0, 6), member('d', 0, 1)],
      W,
    );
    expect(rows.map((r) => [r.user.id, r.score, r.rank])).toEqual([
      ['b', 6, 1],
      ['c', 6, 1],
      ['a', 3, 2],
      ['d', 1, 3],
    ]);
    expect(rows[1].completed).toBe(6);
  });

  it('lists tied members by name, which never changes their rank', () => {
    const rows = rank([member('x', 1, 0, 'Vy'), member('y', 1, 0, 'An')], W);
    expect(rows.map((r) => r.user.displayName)).toEqual(['An', 'Vy']);
    expect(rows.every((r) => r.rank === 1)).toBe(true);
  });

  it('leaves out members with nothing completed in the period', () => {
    expect(rank([member('a', 0, 0)], W)).toEqual([]);
    // a self_check weight of 0 means self_check alone does not put anyone on the board
    expect(rank([member('a', 0, 4)], { graded: 3, selfCheck: 0 })).toEqual([]);
  });

  it('returns the top rows and the viewer, even when the viewer is below the top', () => {
    const rows = rank(
      Array.from({ length: 12 }, (_, i) => member(`m${i}`, 12 - i, 0)),
      W,
    );
    const { top, me } = topAndMe(rows, 'm11', 10);
    expect(top).toHaveLength(10);
    expect(me).toMatchObject({ rank: 12, score: 3 });
    expect(topAndMe(rows, 'stranger', 10).me).toBeNull();
  });
});
