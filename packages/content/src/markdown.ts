import type { ContentIssue } from './types';

export const MAX_MARKDOWN_BYTES = 200 * 1024;

/**
 * Raw HTML that could run code in the reader's browser. Checked only OUTSIDE code,
 * because an HTML/JS lesson must be able to show `<script>` inside a code block.
 */
const FORBIDDEN_HTML = [
  /<script\b/i,
  /<iframe\b/i,
  /javascript:/i,
  /<[a-z][^>]*\son\w+\s*=/i, // inline event handler, e.g. <img onerror=...>
];

/** Remove fenced blocks (``` or ~~~) and inline code (`x` or ``x``). */
function removeCode(markdown: string): string {
  return markdown
    .replace(/^(```|~~~)[\s\S]*?^\1/gm, '')
    .replace(/``[^\n]*?``/g, '')
    .replace(/`[^`\n]*`/g, '');
}

/** Size limit + forbidden HTML. Adds issues; never throws. */
export function checkMarkdown(path: string, markdown: string, issues: ContentIssue[]): void {
  if (Buffer.byteLength(markdown, 'utf8') > MAX_MARKDOWN_BYTES) {
    issues.push({ path, message: `markdown is larger than ${MAX_MARKDOWN_BYTES / 1024} KB` });
  }
  const prose = removeCode(markdown);
  for (const pattern of FORBIDDEN_HTML) {
    if (pattern.test(prose)) {
      issues.push({ path, message: `raw HTML/script is not allowed (${pattern.source})` });
    }
  }
}

/** Split `---\n<yaml>\n---\n<body>`. `data` is null when there is no front matter. */
export function splitFrontMatter(text: string): { data: string | null; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  return match ? { data: match[1], body: text.slice(match[0].length) } : { data: null, body: text };
}
