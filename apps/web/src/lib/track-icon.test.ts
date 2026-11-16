import { describe, expect, it } from 'vitest';
import { trackIconLabel } from './track-icon';

describe('trackIconLabel', () => {
  it('uses a known tag first', () => {
    expect(trackIconLabel({ title: 'Anything', tags: ['postgresql'] })).toBe('SQL');
  });

  it('finds a known topic in the title when there are no tags', () => {
    expect(trackIconLabel({ title: '30 ngày học SQL' })).toBe('SQL');
    expect(trackIconLabel({ title: 'Làm quen Git & GitHub' })).toBe('Git');
  });

  it('falls back to the first letters of the first two words', () => {
    expect(trackIconLabel({ title: 'Thuật toán cơ bản' })).toBe('TT');
  });
});
