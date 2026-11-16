import { describe, expect, it } from 'vitest';
import { parseEmailList } from './email-list';

describe('parseEmailList', () => {
  it('accepts one email per line, commas, semicolons and spaces', () => {
    const r = parseEmailList('a@gmail.com\nb@student.hcmute.edu.vn, c@x.vn; d@y.com e@z.org');
    expect(r.valid).toEqual([
      'a@gmail.com',
      'b@student.hcmute.edu.vn',
      'c@x.vn',
      'd@y.com',
      'e@z.org',
    ]);
    expect(r.invalid).toEqual([]);
  });

  it('trims, lower-cases and drops duplicates (counting them)', () => {
    const r = parseEmailList('  Linh@Gmail.com \nlinh@gmail.com\nLINH@GMAIL.COM');
    expect(r.valid).toEqual(['linh@gmail.com']);
    expect(r.duplicates).toBe(2);
  });

  it('keeps the address from "Name <email>" pastes', () => {
    expect(parseEmailList('Nguyen An <an@gmail.com>').valid).toEqual(['an@gmail.com']);
  });

  it('reports tokens that are not emails', () => {
    const r = parseEmailList('an@gmail.com\nnot-an-email\nb@nodot');
    expect(r.valid).toEqual(['an@gmail.com']);
    expect(r.invalid).toContain('not-an-email');
    expect(r.invalid).toContain('b@nodot');
  });

  it('returns empty lists for blank input', () => {
    expect(parseEmailList('  \n ')).toEqual({ valid: [], invalid: [], duplicates: 0 });
  });
});
