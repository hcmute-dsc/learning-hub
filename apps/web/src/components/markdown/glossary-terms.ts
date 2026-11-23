/**
 * Marks the first use of each new word of a lesson (learning-hub#106, CONTENT-SPECIFICATION
 * §3.1c): the first time a term from the lesson's `terms:` appears in the text, it is wrapped
 * in `<dfn data-glossary="anchor">`, which Markdown.tsx renders as a note that opens on tap or
 * keyboard (GlossaryNote.tsx).
 *
 * Runs on the HTML tree (hast) AFTER rehype-sanitize, so the attribute cannot come from the
 * author: sanitize drops `data-*` from raw HTML. Text inside code, headings, links and
 * existing <dfn> is never marked. Pure: tested in glossary-terms.test.ts.
 */

interface HastText {
  type: 'text';
  value: string;
}

interface HastElement {
  type: 'element';
  tagName: string;
  properties?: Record<string, unknown>;
  children: HastNode[];
}

type HastNode = HastText | HastElement | { type: string; children?: HastNode[] };

/** Text under these tags keeps its words as they are. */
const SKIP = new Set([
  'pre',
  'code',
  'kbd',
  'samp',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'a',
  'dfn',
  'button',
  'summary',
  'script',
  'style',
]);

export interface GlossaryMatch {
  term: string;
  anchor: string;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The term as a whole word, any case: `init` matches "Init" but not "initial". A letter,
 * digit or `_` right before or after means it is part of a longer word.
 */
function wordPattern(term: string): RegExp {
  const words = term.trim().split(/\s+/).map(escapeRegExp).join('\\s+');
  return new RegExp(`(?<![\\p{L}\\p{N}_])${words}(?![\\p{L}\\p{N}_])`, 'iu');
}

/** rehype plugin: `[rehypeGlossaryTerms, terms]` in Markdown.tsx. */
export function rehypeGlossaryTerms(terms: GlossaryMatch[]) {
  return (tree: HastNode) => markFirstUses(tree, terms);
}

/** Wraps the first use of each term, in document order. Mutates and returns `tree`. */
export function markFirstUses<T extends HastNode>(tree: T, terms: GlossaryMatch[]): T {
  // Longer terms first, so "pull request" wins over "pull" at the same place.
  const pending = [...terms]
    .sort((a, b) => b.term.length - a.term.length)
    .map((t) => ({ ...t, pattern: wordPattern(t.term) }));
  if (pending.length > 0) visit(tree);
  return tree;

  function visit(node: HastNode): void {
    if (pending.length === 0 || !('children' in node) || !node.children) return;
    if (node.type === 'element' && SKIP.has((node as HastElement).tagName)) return;
    const out: HastNode[] = [];
    for (const child of node.children) {
      if (child.type === 'text') out.push(...splitText((child as HastText).value));
      else {
        visit(child);
        out.push(child);
      }
    }
    node.children = out;
  }

  /** The text with the earliest first use of a pending term wrapped, the rest scanned again. */
  function splitText(value: string): HastNode[] {
    let best: { index: number; length: number; term: (typeof pending)[number] } | null = null;
    for (const term of pending) {
      const m = term.pattern.exec(value);
      if (m && (best === null || m.index < best.index))
        best = { index: m.index, length: m[0].length, term };
    }
    if (!best) return value ? [{ type: 'text', value }] : [];

    pending.splice(pending.indexOf(best.term), 1);
    const before = value.slice(0, best.index);
    const word = value.slice(best.index, best.index + best.length);
    const after = value.slice(best.index + best.length);
    const dfn: HastElement = {
      type: 'element',
      tagName: 'dfn',
      properties: { dataGlossary: best.term.anchor },
      children: [{ type: 'text', value: word }],
    };
    return [
      ...(before ? [{ type: 'text', value: before } as HastText] : []),
      dfn,
      ...splitText(after),
    ];
  }
}
