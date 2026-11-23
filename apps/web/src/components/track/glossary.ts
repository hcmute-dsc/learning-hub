/**
 * "Từ vựng" of a track (learning-hub#106, CONTENT-SPECIFICATION §3.1c): links, A–Z groups and
 * search. Pure functions: tested in glossary.test.ts.
 */

/** The "Từ vựng" page of a track, or one term on it. */
export function glossaryHref(trackSlug: string, anchor?: string): string {
  return `/tracks/${trackSlug}/glossary${anchor ? `#${anchor}` : ''}`;
}

/** Lower case, without Vietnamese marks: "Khởi tạo" and "khoi tao" both become "khoi tao". */
export function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/** Letter a term is filed under: A–Z, or `#` for anything else (digits, symbols). */
export function glossaryLetter(term: string): string {
  const first = foldText(term).trim().charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : '#';
}

/** Anchor of a letter heading: `letter-A`, and `letter-other` for `#`. */
export function letterId(letter: string): string {
  return `letter-${letter === '#' ? 'other' : letter}`;
}

export interface GlossaryGroup<T> {
  letter: string;
  terms: T[];
}

/** Terms sorted A–Z (case ignored) and grouped by first letter; `#` comes last. */
export function glossaryGroups<T extends { term: string }>(terms: T[]): GlossaryGroup<T>[] {
  const sorted = [...terms].sort((a, b) =>
    a.term.localeCompare(b.term, 'en', { sensitivity: 'base', numeric: true }),
  );
  const groups = new Map<string, T[]>();
  for (const term of sorted) {
    const letter = glossaryLetter(term.term);
    groups.set(letter, [...(groups.get(letter) ?? []), term]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)))
    .map(([letter, list]) => ({ letter, terms: list }));
}

interface Searchable {
  term: string;
  expansion: string | null;
  literal: string | null;
  meaning: string;
}

/**
 * True when every word of the query is in the term, its full form, its literal meaning or its
 * meaning. Case and Vietnamese marks are ignored, so "khoi tao" finds "init".
 */
export function matchesGlossaryQuery(term: Searchable, query: string): boolean {
  const words = foldText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = foldText(
    [term.term, term.expansion, term.literal, term.meaning].filter(Boolean).join(' '),
  );
  return words.every((word) => haystack.includes(word));
}
