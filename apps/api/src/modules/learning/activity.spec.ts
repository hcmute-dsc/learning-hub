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

describe('streaks (one missed day is forgiven, PRD F12)', () => {
  it('counts the run ending today', () => {
    expect(streaks(['2026-11-15', '2026-11-16', '2026-11-17'], '2026-11-17')).toEqual({
      current: 3,
      longest: 3,
    });
  });

  it('keeps the streak until the day is over', () => {
    expect(streaks(['2026-11-15', '2026-11-16'], '2026-11-17').current).toBe(2);
  });

  it('forgives one missed day inside a run and counts active days only', () => {
    // 14, 15, (16 missed), 17: still one run of 3 active days
    expect(streaks(['2026-11-14', '2026-11-15', '2026-11-17'], '2026-11-17')).toEqual({
      current: 3,
      longest: 3,
    });
  });

  it('keeps the streak alive when yesterday was the missed day', () => {
    // last learned on the 15th, nothing on the 16th; on the 17th the run can still go on
    expect(streaks(['2026-11-14', '2026-11-15'], '2026-11-17').current).toBe(2);
  });

  it('ends the streak after two missed days in a row, but remembers the longest run', () => {
    expect(streaks(['2026-11-13', '2026-11-14'], '2026-11-17')).toEqual({ current: 0, longest: 2 });
    expect(
      streaks(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-06', '2026-11-16'], '2026-11-17'),
    ).toEqual({ current: 1, longest: 3 });
  });

  it('allows several single missed days in one run', () => {
    const days = ['2026-11-01', '2026-11-03', '2026-11-05', '2026-11-07', '2026-11-09'];
    expect(streaks(days, '2026-11-10')).toEqual({ current: 5, longest: 5 });
  });

  it('uses Vietnam days at the midnight boundary', () => {
    // 16:59 UTC is 23:59 on the 16th in Vietnam, 17:00 UTC is 00:00 on the 17th
    const days = countByDay([new Date('2026-11-16T16:59:00Z'), new Date('2026-11-16T17:00:00Z')]);
    expect(streaks(days.keys(), '2026-11-17')).toEqual({ current: 2, longest: 2 });
  });

  it('works across a month and a year boundary', () => {
    expect(streaks(['2026-12-30', '2026-12-31', '2027-01-02'], '2027-01-02').current).toBe(3);
  });

  it('ignores days after today and repeated days', () => {
    expect(streaks(['2026-11-17', '2026-11-17', '2026-11-20'], '2026-11-17')).toEqual({
      current: 1,
      longest: 1,
    });
  });

  it('is zero with no activity', () => {
    expect(streaks([], '2026-11-17')).toEqual({ current: 0, longest: 0 });
  });
});
