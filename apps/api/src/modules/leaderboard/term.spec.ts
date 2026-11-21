import { nextTermId, previousTermId, resolveTerm, termAt, termById, vietnamMidnight } from './term';

/** Terms of the leaderboard (term.ts): the board resets each term, in Vietnam time. */
describe('leaderboard terms', () => {
  it('puts each month in the right term of the school year', () => {
    expect(termAt(new Date('2026-11-21T05:00:00Z')).id).toBe('2026-1');
    expect(termAt(new Date('2027-01-15T05:00:00Z')).id).toBe('2026-1');
    expect(termAt(new Date('2027-03-01T05:00:00Z')).id).toBe('2026-2');
    expect(termAt(new Date('2027-07-20T05:00:00Z')).id).toBe('2026-3');
    expect(termAt(new Date('2027-09-02T05:00:00Z')).id).toBe('2027-1');
  });

  it('switches terms at midnight Vietnam time, not UTC', () => {
    // 31 Jan 2027 23:30 in Vietnam is still HK1; 00:10 on 1 Feb is HK2
    expect(termAt(new Date('2027-01-31T16:30:00Z')).id).toBe('2026-1');
    expect(termAt(new Date('2027-01-31T17:10:00Z')).id).toBe('2026-2');
  });

  it('builds terms that follow each other without a gap', () => {
    const hk1 = termById('2026-1')!;
    expect(hk1.label).toBe('Học kỳ 1, 2026–2027');
    expect(hk1.startsAt).toEqual(vietnamMidnight(2026, 9, 1));
    expect(hk1.endsAt).toEqual(termById('2026-2')!.startsAt);
    expect(termById('2026-2')!.endsAt).toEqual(termById('2026-3')!.startsAt);
    expect(termById('2026-3')!.endsAt).toEqual(termById('2027-1')!.startsAt);
    expect(termById('2026-3')!.label).toBe('Học kỳ hè, 2026–2027');
  });

  it('steps to the previous and next term across school years', () => {
    expect(previousTermId('2026-1')).toBe('2025-3');
    expect(previousTermId('2026-3')).toBe('2026-2');
    expect(nextTermId('2026-3')).toBe('2027-1');
    expect(nextTermId('2026-1')).toBe('2026-2');
  });

  it('refuses malformed ids', () => {
    expect(termById('2026-4')).toBeNull();
    expect(termById('hk1')).toBeNull();
    expect(previousTermId('x')).toBeNull();
  });

  it('resolves the current term by default, past terms on request, never future ones', () => {
    const now = new Date('2026-11-21T05:00:00Z');
    expect(resolveTerm(undefined, now)!.id).toBe('2026-1');
    expect(resolveTerm('2025-3', now)!.id).toBe('2025-3');
    expect(resolveTerm('2026-2', now)).toBeNull();
    expect(resolveTerm('2026-9', now)).toBeNull();
  });
});
