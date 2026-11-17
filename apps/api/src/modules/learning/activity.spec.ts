import { activityGrid, countByDay, streaks, vietnamDay } from './activity';

describe('vietnamDay', () => {
  it('uses Vietnam time (UTC+7)', () => {
    expect(vietnamDay(new Date('2026-11-16T16:59:00Z'))).toBe('2026-11-16');
    expect(vietnamDay(new Date('2026-11-16T17:00:00Z'))).toBe('2026-11-17');
  });
});

describe('countByDay', () => {
  it('counts actions per Vietnam day', () => {
    const counts = countByDay([
      new Date('2026-11-17T01:00:00Z'),
      new Date('2026-11-17T09:00:00Z'),
      new Date('2026-11-16T03:00:00Z'),
    ]);
    expect(Object.fromEntries(counts)).toEqual({ '2026-11-17': 2, '2026-11-16': 1 });
  });
});

describe('activityGrid', () => {
  it('starts on a Monday, ends today and fills missing days with zero', () => {
    // 2026-11-17 is a Tuesday
    const grid = activityGrid(new Map([['2026-11-16', 3]]), '2026-11-17', 2);
    expect(grid[0]).toEqual({ date: '2026-11-09', count: 0 });
    expect(grid.at(-1)).toEqual({ date: '2026-11-17', count: 0 });
    expect(grid).toHaveLength(9);
    expect(grid.find((d) => d.date === '2026-11-16')?.count).toBe(3);
  });
});

describe('streaks', () => {
  it('counts the run ending today', () => {
    expect(streaks(['2026-11-15', '2026-11-16', '2026-11-17'], '2026-11-17')).toEqual({
      current: 3,
      longest: 3,
    });
  });

  it('keeps the streak until the day is over', () => {
    expect(streaks(['2026-11-15', '2026-11-16'], '2026-11-17').current).toBe(2);
  });

  it('loses the streak after a missed day, but remembers the longest run', () => {
    expect(streaks(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-14'], '2026-11-17')).toEqual(
      { current: 0, longest: 3 },
    );
  });

  it('is zero with no activity', () => {
    expect(streaks([], '2026-11-17')).toEqual({ current: 0, longest: 0 });
  });
});
