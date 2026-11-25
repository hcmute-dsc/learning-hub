/**
 * A member's "Mô tả" as Markdown in a public GitHub issue (learning-hub#125), without the
 * side effects GitHub gives Markdown: nobody is pinged, nothing links to other issues,
 * no raw HTML, no `javascript:` or `data:` links. Pure, tested in issue-markdown.spec.ts.
 *
 * What happens to the text:
 * - Fenced code blocks (``` or ~~~) are kept as they are, with a new fence longer than any
 *   run of backticks inside, so the code cannot close it early. An unclosed fence is
 *   closed at the end of the text, so it cannot swallow the rest of the issue.
 * - Outside code blocks:
 *   - `@user`, `#12`, `GH-12` and `owner/repo#12` get a zero-width space after `@`, `#`
 *     or `GH`. They read the same, but GitHub no longer links them, so no one is
 *     notified and no other issue gets a "mentioned in" entry. URLs are left alone.
 *   - `<` becomes `&lt;`, so HTML tags and comments show as plain text.
 *   - A link or image to anything but http(s), mailto or a plain relative path loses its
 *     destination and keeps its text: `[x](javascript:…)` becomes `[x]`.
 * - `inline code` is left as it is, except when we cannot be sure GitHub sees the same
 *   code spans (an unmatched backtick in the paragraph, or a `|` that may make it a table
 *   row): then `<` is escaped inside it too. It looks worse but it is never unsafe.
 */

const ZWSP = '​';

/** An opening code fence: up to 3 spaces, 3+ backticks or tildes, then the info string. */
const FENCE_OPEN = /^( {0,3})(`{3,}|~{3,})(.*)$/;

export function issueMarkdown(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let prose: string[] = [];

  const flushProse = () => {
    if (prose.length > 0) out.push(neutralizeProse(prose.join('\n')));
    prose = [];
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const open = FENCE_OPEN.exec(line);
    // A backtick fence's info string may not contain a backtick (CommonMark §4.5).
    if (!open || (open[2].startsWith('`') && open[3].includes('`'))) {
      prose.push(line);
      i++;
      continue;
    }
    flushProse();
    const indent = open[1].length;
    const marker = open[2];
    const code: string[] = [];
    i++;
    while (i < lines.length && !closesFence(lines[i], marker)) {
      code.push(removeIndent(lines[i], indent));
      i++;
    }
    i++; // the closing fence; past the end when the fence was never closed
    out.push(fenced(code, fenceLanguage(open[3])));
  }
  flushProse();
  return out.join('\n');
}

function closesFence(line: string, marker: string): boolean {
  const m = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
  return m !== null && m[1][0] === marker[0] && m[1].length >= marker.length;
}

/** Content lines lose up to as many leading spaces as the opening fence had. */
function removeIndent(line: string, indent: number): string {
  let n = 0;
  while (n < indent && line[n] === ' ') n++;
  return line.slice(n);
}

/** Only a plain language name (sql, c++, c#, shell…) is kept from the info string. */
function fenceLanguage(info: string): string {
  const word = info.trim().split(/\s+/)[0] ?? '';
  return /^[A-Za-z0-9_+#.-]{1,30}$/.test(word) ? word : '';
}

function fenced(code: string[], language: string): string {
  const body = code.join('\n');
  const longest = Math.max(0, ...(body.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}${language}\n${body}${code.length > 0 ? '\n' : ''}${fence}`;
}

/** Everything outside fenced code blocks. */
function neutralizeProse(block: string): string {
  const lines = dropUnsafeLinks(block).split('\n');
  // Code spans never cross a blank line, so paragraphs can be judged one by one.
  const result: string[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    const sure = paragraph.every((line) => !line.includes('|') && backticksPairUp(line));
    for (const line of paragraph) result.push(neutralizeLine(line, sure));
    paragraph = [];
  };
  for (const line of lines) {
    if (line.trim() === '') {
      flush();
      result.push(line);
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return result.join('\n');
}

function neutralizeLine(line: string, keepCodeSpans: boolean): string {
  const parts = keepCodeSpans ? splitCodeSpans(line) : [{ code: false, text: line }];
  let out = '';
  for (const part of parts) {
    out += part.code ? noLinkedRefs(part.text) : noLinkedRefs(escapeHtml(part.text));
  }
  return noUnsafeDefinition(out);
}

interface Part {
  code: boolean;
  text: string;
}

/**
 * Splits a line into text and `code spans` the way CommonMark does on one line: a run of
 * N backticks opens a span closed by the next run of exactly N; a backslash escapes a
 * backtick outside a span. `unmatched` counts runs that close nothing.
 */
function scanCodeSpans(line: string): { parts: Part[]; unmatched: number } {
  const parts: Part[] = [];
  let unmatched = 0;
  let start = 0;
  let i = 0;
  while (i < line.length) {
    if (line[i] === '\\') {
      i += 2;
      continue;
    }
    if (line[i] !== '`') {
      i++;
      continue;
    }
    const n = runLength(line, i);
    const close = findRun(line, i + n, n);
    if (close < 0) {
      unmatched++;
      i += n;
      continue;
    }
    if (i > start) parts.push({ code: false, text: line.slice(start, i) });
    parts.push({ code: true, text: line.slice(i, close + n) });
    i = close + n;
    start = i;
  }
  if (start < line.length) parts.push({ code: false, text: line.slice(start) });
  return { parts, unmatched };
}

function splitCodeSpans(line: string): Part[] {
  return scanCodeSpans(line).parts;
}

function backticksPairUp(line: string): boolean {
  return scanCodeSpans(line).unmatched === 0;
}

function runLength(line: string, at: number): number {
  let n = 0;
  while (line[at + n] === '`') n++;
  return n;
}

/** Index of the next run of exactly `n` backticks from `from`, or -1. */
function findRun(line: string, from: number, n: number): number {
  let i = from;
  while (i < line.length) {
    if (line[i] !== '`') {
      i++;
      continue;
    }
    const m = runLength(line, i);
    if (m === n) return i;
    i += m;
  }
  return -1;
}

/** `<` → `&lt;`, unless a backslash already makes it plain text. */
function escapeHtml(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\\' && i + 1 < text.length) {
      out += c + text[i + 1];
      i++;
    } else if (c === '<') {
      out += '&lt;';
    } else {
      out += c;
    }
  }
  return out;
}

const URL_PATTERN = /(?:https?:\/\/|www\.|mailto:)[^\s<>]*/gi;

/** Mentions and issue references stop being links; URLs are left as they are. */
function noLinkedRefs(text: string): string {
  let out = '';
  let last = 0;
  for (const url of text.matchAll(URL_PATTERN)) {
    const at = url.index ?? 0;
    out += breakRefs(text.slice(last, at)) + url[0];
    last = at + url[0].length;
  }
  return out + breakRefs(text.slice(last));
}

function breakRefs(text: string): string {
  return text
    .replace(/@(?=[A-Za-z0-9])/g, `@${ZWSP}`)
    .replace(/#(?=\d)/g, `#${ZWSP}`)
    .replace(/\b(GH)-(?=\d)/gi, `$1${ZWSP}-`);
}

/**
 * Safe link destinations: http(s), mailto, an anchor, or a plain relative path. Anything
 * with another scheme is not, nor anything CommonMark could decode into one (`&#58;`,
 * `\:`), so `javascript:`, `data:` and `vbscript:` never get through.
 */
export function isSafeLinkUrl(url: string): boolean {
  const u = url.trim();
  if (u === '') return true;
  if (/^(?:https?:\/\/|mailto:)/i.test(u)) return true;
  return !/[:&\\]/.test(u);
}

/** `[text](unsafe…)` and `![alt](unsafe…)` → `[text]` / `![alt]`, shown as plain text. */
function dropUnsafeLinks(s: string): string {
  let out = '';
  let i = 0;
  for (;;) {
    const k = s.indexOf('](', i);
    if (k < 0) return out + s.slice(i);
    out += s.slice(i, k + 1);
    const dest = readDestination(s, k + 2);
    if (isSafeLinkUrl(dest.url)) {
      i = k + 1;
    } else {
      i = closingParen(s, dest.end);
    }
  }
}

/** The destination after `](`: optional spaces and one line break, then `<…>` or a bare URL. */
function readDestination(s: string, from: number): { url: string; end: number } {
  let j = from;
  while (s[j] === ' ' || s[j] === '\t') j++;
  if (s[j] === '\n') {
    j++;
    while (s[j] === ' ' || s[j] === '\t') j++;
  }
  if (s[j] === '<') {
    let end = j + 1;
    while (end < s.length && s[end] !== '>' && s[end] !== '\n') end++;
    return { url: s.slice(j + 1, end), end: end + 1 };
  }
  let depth = 0;
  let end = j;
  while (end < s.length && !/\s/.test(s[end])) {
    if (s[end] === '\\') {
      end += 2;
      continue;
    }
    if (s[end] === '(') depth++;
    if (s[end] === ')') {
      if (depth === 0) break;
      depth--;
    }
    end++;
  }
  return { url: s.slice(j, Math.min(end, s.length)), end: Math.min(end, s.length) };
}

/** Just after the `)` that ends the link (skipping a title), or `from` if there is none. */
function closingParen(s: string, from: number): number {
  let depth = 0;
  for (let i = from; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') {
      i++;
      continue;
    }
    if (c === '\n' && s[i + 1] === '\n') return from;
    if (c === '(') depth++;
    if (c === ')') {
      if (depth === 0) return i + 1;
      depth--;
    }
  }
  return from;
}

/**
 * A reference definition (`[x]: javascript:…`) with an unsafe or missing destination is
 * turned into plain text by escaping its `[`.
 */
function noUnsafeDefinition(line: string): string {
  const m = /^( {0,3})\[([^\]]*)\]:[ \t]*(\S*)/.exec(line);
  if (!m) return line;
  const dest = m[3].replace(/^<|>$/g, '');
  if (m[3] !== '' && isSafeLinkUrl(dest)) return line;
  return `${m[1]}\\${line.slice(m[1].length)}`;
}
