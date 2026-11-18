import { describe, expect, it } from 'vitest';
import { shortSha, waitLabel } from './overview-format';

describe('waitLabel', () => {
  it('reads hours under a day and days above', () => {
    expect(waitLabel(0)).toBe('dưới 1 giờ');
    expect(waitLabel(5)).toBe('5 giờ');
    expect(waitLabel(24)).toBe('1 ngày');
    expect(waitLabel(50)).toBe('2 ngày 2 giờ');
  });
});

describe('shortSha', () => {
  it('keeps seven characters', () => {
    expect(shortSha('0123456789abcdef')).toBe('0123456');
  });
});
