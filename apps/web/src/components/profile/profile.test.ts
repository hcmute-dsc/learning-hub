import { describe, expect, it } from 'vitest';
import { activityLevel, formatDay, formatMonth, toWeeks, visibleRoles } from './profile';

describe('visibleRoles', () => {
  it('hides "member" when the member has another role', () => {
    expect(visibleRoles(['member', 'admin'])).toEqual(['admin']);
    expect(visibleRoles(['member'])).toEqual(['member']);
  });
});

describe('activityLevel', () => {
  it('maps counts to five shades', () => {
    expect([0, 1, 2, 3, 4, 6, 7, 20].map(activityLevel)).toEqual([0, 1, 2, 2, 3, 3, 4, 4]);
  });
});

describe('toWeeks', () => {
  it('splits days into weeks of seven, keeping a short last week', () => {
    const days = Array.from({ length: 9 }, (_, i) => ({ date: `d${i}`, count: 0 }));
    expect(toWeeks(days).map((w) => w.length)).toEqual([7, 2]);
  });
});

describe('formatDay / formatMonth', () => {
  it('formats dates the Vietnamese way', () => {
    expect(formatDay('2026-11-17')).toBe('17/11/2026');
    expect(formatMonth('2026-11-16T18:00:00Z')).toBe('tháng 11/2026');
  });
});
