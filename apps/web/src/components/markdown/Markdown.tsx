import type { ComponentPropsWithoutRef } from 'react';
import type { GlossaryTerm } from '@hub/shared';
import ReactMarkdown, { defaultUrlTransform, type Components } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { rewriteContentUrl, type ContentOrigin } from './content-url';
import { glossaryHref } from '@/components/track/glossary';
import { CodeBlock } from './CodeBlock';
import { GlossaryNote } from './GlossaryNote';
import { rehypeGlossaryTerms } from './glossary-terms';
import { MermaidDiagram } from './MermaidDiagram';
import { mermaidSource } from './mermaid-source';
import { TableWrap } from './TableWrap';

/**
 * Renders Markdown from a content repo (lessons, exercise statements).
 *
 * SECURITY §3: content is written by club members, so it is untrusted. Raw HTML is
 * parsed (rehype-raw, so authors can use <details>/<summary> like on GitHub) and then
 * sanitized with the default GitHub-like schema (rehype-sanitize) BEFORE React renders
 * it. Unsafe URL protocols are dropped by react-markdown's defaultUrlTransform.
 *
 * Code blocks are colored by rehype-highlight (highlight.js, on the server, no browser
 * JS). It runs AFTER sanitize: it only adds <span class="hljs-*">, and sanitize would
 * strip those classes. Only fences with a language (```sql) are colored; the token
 * colors are in globals.css ("Code highlighting").
 *
 * ```mermaid fences are not highlighted: the `pre` component hands them to
 * MermaidDiagram, which draws them in the browser.
 *
 * Works in Server and Client Components (no hooks).
 */
export function Markdown({
  source,
  origin = null,
  glossary = null,
}: {
  source: string;
  /** Where the file lives, to resolve its relative links; null keeps them as is */
  origin?: ContentOrigin | null;
  /**
   * New words of a lesson (learning-hub#106): the first use of each gets a note
   * (glossary-terms.ts, GlossaryNote.tsx). Null or no terms: the text is left as is.
   */
  glossary?: { trackSlug: string; terms: GlossaryTerm[] } | null;
}) {
  const terms = glossary?.terms ?? [];
  const components =
    glossary && terms.length > 0 ? withGlossary(glossary.trackSlug, terms) : COMPONENTS;
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeRaw,
          rehypeSanitize,
          // After sanitize: the data-glossary it adds must not come from the author.
          [rehypeGlossaryTerms, terms],
          [rehypeHighlight, { detect: false, plainText: ['mermaid'] }],
        ]}
        urlTransform={(url, key, node) => {
          const safe = defaultUrlTransform(url);
          if (!safe) return safe;
          const kind = key === 'src' && node.tagName === 'img' ? 'image' : 'link';
          return rewriteContentUrl(safe, kind, origin);
        }}
        components={components}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}

/**
 * The page title is the only <h1>, so Markdown headings move one level down to keep
 * the heading order correct for screen readers (FRONTEND-DESIGN §9).
 */
const COMPONENTS: Components = {
  h1: ({ node: _node, ...props }) => <h2 {...props} />,
  h2: ({ node: _node, ...props }) => <h3 {...props} />,
  h3: ({ node: _node, ...props }) => <h4 {...props} />,
  h4: ({ node: _node, ...props }) => <h5 {...props} />,
  h5: ({ node: _node, ...props }) => <h6 {...props} />,
  a: ({ node: _node, ...props }) => <MarkdownLink {...props} />,
  img: ({ node: _node, ...props }) => <MarkdownImage {...props} />,
  // Mermaid fences become diagrams. Other code blocks get a copy button; they can be
  // wide, so they scroll and are reachable by keyboard (FRONTEND-DESIGN §9).
  pre: ({ node, ...props }) => {
    const diagram = mermaidSource(node);
    return diagram === null ? <CodeBlock {...props} /> : <MermaidDiagram code={diagram} />;
  },
  // Wide tables scroll inside their own box instead of squeezing the columns.
  table: ({ node: _node, ...props }) => <TableWrap {...props} />,
};

/** COMPONENTS plus the notes on <dfn data-glossary> that rehypeGlossaryTerms added. */
function withGlossary(trackSlug: string, terms: GlossaryTerm[]): Components {
  const byAnchor = new Map(terms.map((t) => [t.anchor, t]));
  return {
    ...COMPONENTS,
    dfn: ({ node, children, ...props }) => {
      const anchor = node?.properties?.dataGlossary;
      const term = typeof anchor === 'string' ? byAnchor.get(anchor) : undefined;
      if (!term) return <dfn {...props}>{children}</dfn>;
      return (
        <GlossaryNote term={term} href={glossaryHref(trackSlug, term.anchor)}>
          {children}
        </GlossaryNote>
      );
    },
  };
}

function MarkdownLink(props: ComponentPropsWithoutRef<'a'>) {
  const external = typeof props.href === 'string' && /^https?:\/\//.test(props.href);
  // SECURITY §3: links to other sites never get access to window.opener or the referrer.
  return <a {...props} rel={external ? 'noopener noreferrer' : undefined} />;
}

/**
 * GitHub convention: an image URL ending in #gh-dark-mode-only / #gh-light-mode-only
 * is shown in one color scheme only. The CSS classes live in globals.css.
 */
function MarkdownImage({ alt, ...props }: ComponentPropsWithoutRef<'img'>) {
  const src = typeof props.src === 'string' ? props.src : '';
  let className: string | undefined;
  if (src.endsWith('#gh-dark-mode-only')) className = 'gh-dark-mode-only';
  if (src.endsWith('#gh-light-mode-only')) className = 'gh-light-mode-only';
  return <img {...props} alt={alt ?? ''} className={className} loading="lazy" />;
}
