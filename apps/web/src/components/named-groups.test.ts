import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Tailwind's plain `group-hover:` (and `group-open:`, …) matches ANY ancestor with the
 * `group` class, not just the closest one. With cards inside cards that lights up
 * every child at once (#77: hovering one row recoloured the whole chapter). So every
 * group in the app is named (`group/row` + `group-hover/row:`), and this test keeps it
 * that way.
 */
const SRC = join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(tsx|ts)$/.test(entry.name) && !entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

describe('Tailwind groups', () => {
  const files = sourceFiles(SRC).map((path) => ({
    path: path.slice(SRC.length + 1),
    text: readFileSync(path, 'utf8'),
  }));

  it('finds the source files', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('never uses an unnamed group variant such as group-hover:', () => {
    const offenders = files.filter((f) => /\bgroup-[a-z-]+:/.test(f.text)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('never marks an element with a plain group class', () => {
    // role="group" is ARIA (the account menu's sections, #97), not a Tailwind class.
    const offenders = files
      .filter((f) => /(?<=["'`\s])group(?=["'`\s])/.test(f.text.replace(/role="group"/g, '')))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });
});
