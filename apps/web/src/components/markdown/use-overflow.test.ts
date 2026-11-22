import { describe, expect, it } from 'vitest';
import { overflowsX } from './use-overflow';

describe('overflowsX', () => {
  it('is true when the content is wider than the box', () => {
    expect(overflowsX(640, 343)).toBe(true);
  });

  it('is false when the content fits', () => {
    expect(overflowsX(343, 343)).toBe(false);
    expect(overflowsX(200, 343)).toBe(false);
  });

  it('ignores 1px of rounding', () => {
    expect(overflowsX(344, 343)).toBe(false);
    expect(overflowsX(345, 343)).toBe(true);
  });
});
