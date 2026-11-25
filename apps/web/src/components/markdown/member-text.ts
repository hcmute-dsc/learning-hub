/**
 * Rules for Markdown a member typed (content reports, learning-hub#125), used by
 * Markdown from="member". Tested in member-text.test.ts.
 */

/**
 * Links in member text: no access to window.opener or the referrer (SECURITY §3), and
 * search engines are told the hub does not vouch for them.
 */
export const MEMBER_LINK_REL = 'nofollow ugc noopener noreferrer';

export interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
}

/** Nodes that hold blocks (paragraphs), not inline text. */
const BLOCK_PARENTS = new Set(['root', 'blockquote', 'listItem', 'footnoteDefinition']);

/**
 * remark plugin for member text, so it reads the way the same text reads in a GitHub issue:
 * - raw HTML (`<img onerror=…>`, `<script>`, `<!-- -->`) becomes plain text, shown as
 *   typed: nothing a member writes is parsed as HTML (rehype-sanitize still runs after);
 * - a line break is kept ("Sai: …" and "Nên là: …" stay on two lines), like GitHub
 *   issues and comments do.
 */
export function remarkMemberText() {
  return (tree: MdNode) => {
    memberText(tree);
  };
}

export function memberText(node: MdNode): void {
  if (!node.children) return;
  const children: MdNode[] = [];
  for (const child of node.children) {
    let next = child;
    if (child.type === 'html') {
      const text = { type: 'text', value: child.value ?? '' };
      next = BLOCK_PARENTS.has(node.type) ? { type: 'paragraph', children: [text] } : text;
    }
    if (next.type === 'text' && next.value?.includes('\n')) {
      next.value.split('\n').forEach((line, i) => {
        if (i > 0) children.push({ type: 'break' });
        children.push({ type: 'text', value: line });
      });
    } else {
      children.push(next);
    }
  }
  node.children = children;
  for (const child of children) memberText(child);
}

export interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

/**
 * rehype plugin: marks an <img> inside a link with `data-in-link`, so Markdown from="member"
 * shows it as a plain label there instead of nesting a link to the image inside the link.
 * Runs after rehype-sanitize, so the mark never comes from the member.
 */
export function rehypeMarkImagesInLinks() {
  return (tree: HastNode) => {
    markImages(tree, false);
  };
}

export function markImages(node: HastNode, inLink: boolean): void {
  if (node.type === 'element' && node.tagName === 'img' && inLink) {
    node.properties = { ...node.properties, dataInLink: true };
  }
  const nowInLink = inLink || (node.type === 'element' && node.tagName === 'a');
  for (const child of node.children ?? []) markImages(child, nowInLink);
}
