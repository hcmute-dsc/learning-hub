import { describe, expect, it } from 'vitest';
import type { Leaderboard, LeaderboardRow } from '@hub/shared';
import { avatarSmall, shareCardData } from './share-card';

const row = (id: string, rank: number): LeaderboardRow => ({
  rank,
  score: 20 - rank,
  completed: 1,
  user: { id, githubLogin: id, displayName: id, avatarUrl: null },
});

const board = (top: LeaderboardRow[], over: Partial<Leaderboard> = {}): Leaderboard => ({
  range: {
    period: 'term',
    id: '2026-1',
    label: 'Học kỳ 1, 2026–2027',
    startsAt: '',
    endsAt: '',
    previousId: null,
    nextId: null,
  },
  track: null,
  optedIn: true,
  top,
  me: row('viewer', 11),
  weights: { graded: 3, selfCheck: 1 },
  ...over,
});

describe('share card data', () => {
  const ten = Array.from({ length: 10 }, (_, i) => row(`m${i}`, i + 1));

  it('shows the podium and as many list rows as the size fits', () => {
    const square = shareCardData(board(ten), 'square', 'learn.example.org');
    expect(square.podium).toHaveLength(3);
    expect(square.rest.map((r) => r.rank)).toEqual([4, 5, 6, 7, 8, 9, 10]);
    const wide = shareCardData(board(ten), 'wide', 'learn.example.org');
    expect(wide.rest.map((r) => r.rank)).toEqual([4, 5, 6, 7]);
  });

  it('never puts the viewer own row on the image', () => {
    const data = shareCardData(board(ten.slice(0, 2)), 'square', 'x');
    expect([...data.podium, ...data.rest].some((r) => r.user.id === 'viewer')).toBe(false);
  });

  it('names the period and the track, and marks an empty board', () => {
    const data = shareCardData(
      board([], {
        range: { ...board([]).range, period: 'week', label: 'Tuần 47 (16/11 – 22/11/2026)' },
        track: { slug: 'git', title: 'Git & GitHub' },
      }),
      'wide',
      'learn.example.org',
    );
    expect(data).toMatchObject({
      title: 'Bảng xếp hạng tuần',
      period: 'Tuần 47 (16/11 – 22/11/2026)',
      track: 'Git & GitHub',
      empty: true,
    });
    expect(data.footer).toContain('không tính tốc độ');
  });

  it('asks GitHub for small avatars only', () => {
    expect(avatarSmall('https://avatars.githubusercontent.com/u/1?v=4', 96)).toBe(
      'https://avatars.githubusercontent.com/u/1?v=4&s=96',
    );
    expect(avatarSmall('https://example.org/a.png', 96)).toBe('https://example.org/a.png');
  });
});
