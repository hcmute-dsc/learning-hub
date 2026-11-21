/**
 * Class names for one row in a module card (see ItemRow).
 *
 * The row is a *named* group (`group/row`) on purpose. A plain `group-hover:` matches
 * any hovered ancestor with the `group` class, and the module card around the rows
 * is a group too (ModuleOutline), so a plain one would light up every row in the
 * chapter at once (#77). `group-hover/row:` only follows the row itself.
 */
export const ROW_CLASS =
  'lift group/row flex items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2.5 sm:px-4';

export const ROW_TITLE_CLASS = 'block font-medium leading-snug group-hover/row:text-brand-600';
