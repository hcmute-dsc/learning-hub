import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Mobile first (learning-hub#103). Most members open the hub on a phone, so the plain
 * styles are the phone layout and `sm:` / `md:` / `lg:` (or `@media (min-width)`) only
 * add to it on bigger screens. The opposite way, a desktop layout shrunk with `max-*:`
 * or `@media (max-width)`, is what this test keeps out, together with fixed widths
 * wider than a phone.
 */
const SRC = join(__dirname, '..');

/** A phone is about 360–390px wide; anything fixed and wider must start at a breakpoint. */
const PHONE_REM = 20;

function sourceFiles(dir: string, pattern: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path, pattern);
    return pattern.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function read(paths: string[]) {
  return paths.map((path) => ({
    path: path.slice(SRC.length + 1),
    text: readFileSync(path, 'utf8'),
  }));
}

/** Width classes like `min-w-[60rem]` or `w-[500px]` with no breakpoint before them. */
export function wideFixedWidths(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(/(?<![\w:-])(?:min-w|w)-\[(\d+(?:\.\d+)?)(rem|px)\]/g)) {
    const rem = m[2] === 'px' ? Number(m[1]) / 16 : Number(m[1]);
    if (rem > PHONE_REM) found.push(m[0]);
  }
  return found;
}

describe('mobile first', () => {
  const code = read(sourceFiles(SRC, /\.tsx?$/));
  const css = read(sourceFiles(SRC, /\.css$/));

  it('finds the source files', () => {
    expect(code.length).toBeGreaterThan(20);
    expect(css.length).toBeGreaterThan(0);
  });

  it('never shrinks a desktop layout with a max-* variant', () => {
    const offenders = code
      .filter((f) => /(?<![\w-])max-(?:sm|md|lg|xl|2xl|\[[^\]]+\]):/.test(f.text))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('never uses @media (max-width) in CSS', () => {
    const offenders = css.filter((f) => /@media[^{]*max-width/.test(f.text)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('never fixes a width wider than a phone without a breakpoint', () => {
    const offenders = code
      .map((f) => ({ path: f.path, widths: wideFixedWidths(f.text) }))
      .filter((f) => f.widths.length > 0);
    expect(offenders).toEqual([]);
  });

  it('spots wide fixed widths, and leaves breakpoint ones and max-w alone', () => {
    expect(wideFixedWidths('w-full min-w-[60rem] text-sm')).toEqual(['min-w-[60rem]']);
    expect(wideFixedWidths('w-[500px]')).toEqual(['w-[500px]']);
    expect(wideFixedWidths('w-full md:min-w-[60rem]')).toEqual([]);
    expect(wideFixedWidths('max-w-[60rem] min-w-[1.1rem] w-[10rem]')).toEqual([]);
  });
});
