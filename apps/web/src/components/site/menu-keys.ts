/**
 * Keyboard rules of the account menu (WAI-ARIA "menu button" pattern), kept pure so
 * they are tested in menu-keys.test.ts:
 * ↓/↑ move and wrap around, Home/End jump to the first/last item.
 * Returns the item to focus, or null when the key is not a menu key.
 */
export function nextMenuIndex(key: string, current: number, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case 'ArrowDown':
      return (current + 1) % count;
    case 'ArrowUp':
      return (current - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

/**
 * Arrow keys on the closed menu button open the menu on the first (↓) or last (↑)
 * item. Enter and Space need nothing here: they click the button, which opens on the first.
 */
export function openingFocus(key: string): 'first' | 'last' | null {
  if (key === 'ArrowDown') return 'first';
  if (key === 'ArrowUp') return 'last';
  return null;
}
