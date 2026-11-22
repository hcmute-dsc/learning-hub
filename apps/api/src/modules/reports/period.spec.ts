import { dayStart, mondayOf, resolvePeriod, vietnamDateTime, vietnamDay } from './period';

describe('report period (Vietnam days)', () => {
  // Sunday 22/11/2026 23:30 in Vietnam = 16:30 UTC
  const sundayNight = new Date('2026-11-22T16:30:00Z');
  // Monday 23/11/2026 00:30 in Vietnam = Sunday 17:30 UTC
  const mondayEarly = new Date('2026-11-22T17:30:00Z');

  it('reads the day and time in Vietnam, not UTC', () => {
    expect(vietnamDay(mondayEarly)).toBe('2026-11-23');
    expect(vietnamDateTime(mondayEarly)).toBe('2026-11-23 00:30');
  });

  it('starts a day at 00:00 Vietnam time and refuses days that do not exist', () => {
    expect(dayStart('2026-11-23')?.toISOString()).toBe('2026-11-22T17:00:00.000Z');
    expect(dayStart('2026-02-30')).toBeNull();
    expect(dayStart('2026-13-01')).toBeNull();
  });

  it('finds the Monday of the current Vietnam week', () => {
    expect(mondayOf(sundayNight)).toBe('2026-11-16');
    expect(mondayOf(mondayEarly)).toBe('2026-11-23');
  });

  it('defaults to this week so far', () => {
    const p = resolvePeriod({}, sundayNight)!;
    expect(p).toMatchObject({ from: '2026-11-16', to: '2026-11-22' });
    expect(p.startsAt.toISOString()).toBe('2026-11-15T17:00:00.000Z');
    expect(p.endsAt.toISOString()).toBe('2026-11-22T17:00:00.000Z');
  });

  it('includes the last day', () => {
    const p = resolvePeriod({ from: '2026-11-23', to: '2026-11-23' }, sundayNight)!;
    expect(p.endsAt.getTime() - p.startsAt.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('refuses a reversed period, a bad day and one longer than 366 days', () => {
    expect(resolvePeriod({ from: '2026-11-24', to: '2026-11-23' }, sundayNight)).toBeNull();
    expect(resolvePeriod({ from: '2026-02-30', to: '2026-03-02' }, sundayNight)).toBeNull();
    expect(resolvePeriod({ from: '2025-01-01', to: '2026-01-01' }, sundayNight)).not.toBeNull();
    expect(resolvePeriod({ from: '2025-01-01', to: '2026-01-02' }, sundayNight)).toBeNull();
  });
});
