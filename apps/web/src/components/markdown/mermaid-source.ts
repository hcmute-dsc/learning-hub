/**
 * Finds Mermaid diagrams in rendered Markdown: a ```mermaid fence becomes
 * <pre><code class="language-mermaid">…</code></pre> in the HTML tree (hast).
 * Pure function, tested in mermaid-source.test.ts; drawn by MermaidDiagram.tsx.
 */

interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: { className?: unknown };
  children?: HastNode[];
}

/** The diagram source when `pre` holds a Mermaid fence, otherwise null. */
export function mermaidSource(pre: HastNode | undefined): string | null {
  const code = pre?.children?.find((child) => child.type === 'element');
  if (!code || code.tagName !== 'code') return null;
  const classes = code.properties?.className;
  if (!Array.isArray(classes) || !classes.includes('language-mermaid')) return null;
  return textOf(code).trimEnd();
}

function textOf(node: HastNode): string {
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map(textOf).join('');
}
