import { safeMetadata, toPage } from './audit-page';

const rows = (...ids: number[]) => ids.map((id) => ({ id: BigInt(id) }));

describe('toPage', () => {
  it('returns a cursor at the last shown row when one more row exists', () => {
    const page = toPage(rows(9, 8, 7), 2);
    expect(page.items.map((r) => Number(r.id))).toEqual([9, 8]);
    expect(page.nextCursor).toBe('8');
  });

  it('has no cursor on the last page', () => {
    expect(toPage(rows(9, 8), 2).nextCursor).toBeNull();
    expect(toPage([], 50)).toEqual({ items: [], nextCursor: null });
  });
});

describe('safeMetadata', () => {
  it('keeps counts and codes', () => {
    expect(safeMetadata({ mode: 'append', total: 3, roles: ['admin'] })).toEqual({
      mode: 'append',
      total: 3,
      roles: ['admin'],
    });
  });

  it('drops anything named like an email field', () => {
    expect(safeMetadata({ emails: ['a@b.c'], Email: 'x', submitted: 1 })).toEqual({
      submitted: 1,
    });
  });

  it('turns non-objects into an empty object', () => {
    expect(safeMetadata(null)).toEqual({});
    expect(safeMetadata([1, 2])).toEqual({});
    expect(safeMetadata('x')).toEqual({});
  });
});
