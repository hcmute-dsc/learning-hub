import { describe, expect, it } from 'vitest';
import { nextMenuIndex, openingFocus } from './menu-keys';

describe('nextMenuIndex', () => {
  it('moves down and up, wrapping at both ends', () => {
    expect(nextMenuIndex('ArrowDown', 0, 4)).toBe(1);
    expect(nextMenuIndex('ArrowDown', 3, 4)).toBe(0);
    expect(nextMenuIndex('ArrowUp', 2, 4)).toBe(1);
    expect(nextMenuIndex('ArrowUp', 0, 4)).toBe(3);
  });

  it('jumps to the first and last item', () => {
    expect(nextMenuIndex('Home', 2, 4)).toBe(0);
    expect(nextMenuIndex('End', 0, 4)).toBe(3);
  });

  it('starts from the top when nothing has focus yet (-1)', () => {
    expect(nextMenuIndex('ArrowDown', -1, 4)).toBe(0);
  });

  it('ignores other keys and empty menus', () => {
    expect(nextMenuIndex('a', 0, 4)).toBeNull();
    expect(nextMenuIndex('Tab', 0, 4)).toBeNull();
    expect(nextMenuIndex('ArrowDown', 0, 0)).toBeNull();
  });
});

describe('openingFocus', () => {
  it('opens on the first item with ↓ and on the last with ↑', () => {
    expect(openingFocus('ArrowDown')).toBe('first');
    expect(openingFocus('ArrowUp')).toBe('last');
  });

  it('leaves Enter and Space to the button click', () => {
    expect(openingFocus('Enter')).toBeNull();
    expect(openingFocus(' ')).toBeNull();
    expect(openingFocus('Escape')).toBeNull();
  });
});
