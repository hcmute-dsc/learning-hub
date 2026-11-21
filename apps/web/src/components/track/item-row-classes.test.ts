import { describe, expect, it } from 'vitest';
import { ROW_CLASS, ROW_TITLE_CLASS } from './item-row-classes';

const tokens = (className: string) => className.split(/\s+/);

describe('item row classes', () => {
  it('makes the row its own named group, not a plain group', () => {
    expect(tokens(ROW_CLASS)).toContain('group/row');
    expect(tokens(ROW_CLASS)).not.toContain('group');
  });

  it('ties the title hover color to the row group only (#77)', () => {
    expect(tokens(ROW_TITLE_CLASS)).toContain('group-hover/row:text-brand-600');
    expect(tokens(ROW_TITLE_CLASS).some((t) => t.startsWith('group-hover:'))).toBe(false);
  });
});
