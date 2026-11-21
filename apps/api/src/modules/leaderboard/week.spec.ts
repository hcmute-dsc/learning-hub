import { isoWeekId, resolveWeek, shiftWeek, weekAt, weekById, weekLabel } from './week';

/** Weeks of the weekly board and the Discord post (week.ts), in Vietnam time. */
describe('leaderboard weeks', () => {
  it('finds the week of a moment, starting Monday 00:00 in Vietnam', () => {
    const w = weekAt(new Date('2026-11-21T05:00:00Z')); // Saturday
    expect(w).toEqual({
      id: '2026-W47',
      startsAt: new Date('2026-11-15T17:00:00Z'),
      endsAt: new Date('2026-11-22T17:00:00Z'),
    });
    // Sunday 23:30 in Vietnam is still W47, Monday 00:10 is W48
    expect(weekAt(new Date('2026-11-22T16:30:00Z')).id).toBe('2026-W47');
    expect(weekAt(new Date('2026-11-22T17:10:00Z')).id).toBe('2026-W48');
  });

  it('parses ids, including weeks across a year and W53', () => {
    expect(weekById('2026-W47')).toEqual(weekAt(new Date('2026-11-18T05:00:00Z')));
    expect(weekById('2026-W01')!.startsAt).toEqual(new Date('2025-12-28T17:00:00Z'));
    expect(weekById('2026-W53')!.id).toBe('2026-W53'); // 2026 has 53 weeks
    expect(weekById('2025-W53')).toBeNull(); // 2025 has 52
    expect(weekById('2026-W00')).toBeNull();
    expect(weekById('2026-47')).toBeNull();
  });

  it('steps across years and labels the days', () => {
    expect(shiftWeek(weekById('2026-W53')!, 1).id).toBe('2027-W01');
    expect(shiftWeek(weekById('2026-W01')!, -1).id).toBe('2025-W52');
    expect(weekLabel(weekById('2026-W47')!)).toBe('Tuần 47 (16/11 – 22/11/2026)');
    expect(weekLabel(weekById('2026-W53')!)).toBe('Tuần 53 (28/12 – 3/1/2027)');
    expect(isoWeekId(new Date('2027-01-01T05:00:00Z'))).toBe('2026-W53');
  });

  it('resolves the current week by default, past weeks on request, never future ones', () => {
    const now = new Date('2026-11-21T05:00:00Z');
    expect(resolveWeek(undefined, now)!.id).toBe('2026-W47');
    expect(resolveWeek('2026-W10', now)!.id).toBe('2026-W10');
    expect(resolveWeek('2026-W48', now)).toBeNull();
    expect(resolveWeek('bad', now)).toBeNull();
  });
});
