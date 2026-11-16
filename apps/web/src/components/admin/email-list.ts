/**
 * Turn pasted text into a clean email list (the admin pastes a column from the club's
 * member form, a Google Sheet, or an email thread). Pure function, tested in
 * email-list.test.ts. The API validates again; this only gives instant feedback.
 */
export interface ParsedEmailList {
  /** trimmed, lower-cased, without duplicates, in first-seen order */
  valid: string[];
  /** tokens that do not look like an email (shown to the admin to fix) */
  invalid: string[];
  /** how many repeated emails were dropped */
  duplicates: number;
}

// Deliberately simple: one "@", a dot in the domain, no spaces. The API's Zod check is stricter.
const LOOKS_LIKE_EMAIL = /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]+$/;

export function parseEmailList(text: string): ParsedEmailList {
  const tokens = text
    .split(/[\s,;]+/)
    // "Nguyễn An <an@gmail.com>" pastes as "<an@gmail.com>"; keep what is inside <>.
    .map((t) => t.replace(/^<|>$/g, '').trim().toLowerCase())
    .filter(Boolean);

  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  let duplicates = 0;
  for (const token of tokens) {
    if (!LOOKS_LIKE_EMAIL.test(token)) {
      invalid.push(token);
    } else if (seen.has(token)) {
      duplicates += 1;
    } else {
      seen.add(token);
      valid.push(token);
    }
  }
  return { valid, invalid, duplicates };
}
