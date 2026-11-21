import { describe, expect, it } from 'vitest';
import type { LeaderboardRow } from '@hub/shared';
import {
  boardHref,
  boardSearch,
  imageFileName,
  imageHref,
  initials,
  medalFor,
  parseBoardQuery,
  parseShareSize,
  podiumOrder,
  splitPodium,
} from './board';

const row = (id: string, rank: number): LeaderboardRow => ({
  rank,
  score: 10 - rank,
  completed: 1,
  user: { id, githubLogin: id, displayName: id, avatarUrl: null },
});

describe('board filters in the URL', () => {
  it('reads term, week and track, and drops malformed values', () => {
    expect(parseBoardQuery({})).toEqual({ period: 'term', id: undefined, track: undefined });
    expect(parseBoardQuery({ term: '2025-3', track: 'sql-30-days' })).toEqual({
      period: 'term',
      id: '2025-3',
      track: 'sql-30-days',
    });
    expect(parseBoardQuery({ period: 'week', week: '2026-W46' })).toMatchObject({
      period: 'week',
      id: '2026-W46',
    });
    // a term id is not a week; junk is ignored
    expect(parseBoardQuery({ period: 'week', term: '2025-3' }).id).toBeUndefined();
    expect(parseBoardQuery({ period: 'alltime', track: '../x' })).toEqual({
      period: 'term',
      id: undefined,
      track: undefined,
    });
  });

  it('writes the same query back, short for the defaults', () => {
    expect(boardSearch({ period: 'term' })).toBe('');
    expect(boardSearch({ period: 'week', id: '2026-W46', track: 'git' })).toBe(
      'period=week&week=2026-W46&track=git',
    );
  });

  it('builds filter links: switching period drops the id, the track stays', () => {
    const q = { period: 'term' as const, id: '2025-3', track: 'git' };
    expect(boardHref(q, { period: 'week' })).toBe('/leaderboard?period=week&track=git');
    expect(boardHref(q, { id: '2025-2' })).toBe('/leaderboard?term=2025-2&track=git');
    expect(boardHref(q, { track: undefined })).toBe('/leaderboard?term=2025-3');
    expect(boardHref({ period: 'week' }, { period: 'term' })).toBe('/leaderboard');
  });
});

describe('share image', () => {
  it('links the PNG with the board filters and a size', () => {
    expect(imageHref({ period: 'week', id: '2026-W46' }, 'wide')).toBe(
      '/leaderboard/image?period=week&week=2026-W46&size=wide',
    );
    expect(imageHref({ period: 'term' }, 'square')).toBe('/leaderboard/image?size=square');
    expect(parseShareSize('wide')).toBe('wide');
    expect(parseShareSize('huge')).toBe('square');
  });

  it('names the saved file after the period, track and size', () => {
    expect(imageFileName('2026-W46', 'git', 'square')).toBe('dsc-leaderboard-2026-W46-git.png');
    expect(imageFileName('2026-1', null, 'wide')).toBe('dsc-leaderboard-2026-1-wide.png');
  });

  it('makes initials for members without an avatar', () => {
    expect(initials('Nguyễn Huỳnh Minh Tiến')).toBe('NT');
    expect(initials('tiennhm')).toBe('TI');
    expect(initials('  ')).toBe('?');
  });
});

describe('podium', () => {
  it('gives gold, silver, bronze to ranks 1–3 only', () => {
    expect([1, 2, 3, 4].map(medalFor)).toEqual(['gold', 'silver', 'bronze', null]);
  });

  it('puts the first three rows on the podium and the rest in the list', () => {
    const rows = [row('a', 1), row('b', 2), row('c', 3), row('d', 4), row('e', 5)];
    const { podium, rest } = splitPodium(rows);
    expect(podium.map((r) => r.user.id)).toEqual(['a', 'b', 'c']);
    expect(rest.map((r) => r.user.id)).toEqual(['d', 'e']);
  });

  it('keeps ties on the podium only up to three people', () => {
    const rows = [row('a', 1), row('b', 1), row('c', 1), row('d', 1)];
    const { podium, rest } = splitPodium(rows);
    expect(podium).toHaveLength(3);
    expect(rest.map((r) => r.user.id)).toEqual(['d']);
  });

  it('works with one or two people', () => {
    expect(splitPodium([row('a', 1)])).toEqual({ podium: [row('a', 1)], rest: [] });
    expect(podiumOrder([row('a', 1), row('b', 2)]).map((r) => r.user.id)).toEqual(['b', 'a']);
    expect(podiumOrder([row('a', 1)]).map((r) => r.user.id)).toEqual(['a']);
  });

  it('draws the podium 2nd, 1st, 3rd', () => {
    const order = podiumOrder([row('a', 1), row('b', 2), row('c', 3)]);
    expect(order.map((r) => r.user.id)).toEqual(['b', 'a', 'c']);
  });
});
