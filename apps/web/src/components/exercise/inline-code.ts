/** A run of quiz text: plain words, or what was written between backticks. */
export type InlinePart = { code: boolean; text: string };

/**
 * Splits `text` on Markdown inline code (`like this`), so quiz prompts, options and
 * explanations can show code without loading the Markdown renderer into the client
 * bundle. Only single backticks on one line count; a lone or unclosed backtick, or an
 * empty pair, stays as written.
 */
export function splitInlineCode(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const pattern = /`([^`\n]+)`/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index;
    if (start > last) parts.push({ code: false, text: text.slice(last, start) });
    parts.push({ code: true, text: match[1] });
    last = start + match[0].length;
  }
  if (last < text.length || parts.length === 0) {
    parts.push({ code: false, text: text.slice(last) });
  }
  return parts;
}
