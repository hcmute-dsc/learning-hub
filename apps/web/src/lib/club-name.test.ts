import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLUB_SHORT_NAME, SITE_NAME } from './club';

const SRC = join(__dirname, '..');

/** Every .ts/.tsx file under apps/web/src, except tests (they never reach the page). */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** "DSC" as a word (also ">DSC_"), not part of "HCMUTE DSC", a URL or an id like hcmute-dsc. */
const LONE_DSC = /(?<!HCMUTE )(?<![-\w/.])DSC(?![-A-Za-z0-9])/;
const COMMENT = /^\s*(\/\/|\/\*|\*|\{\/\*)/;

describe('club name (learning-hub#110)', () => {
  it('is the full "HCMUTE DSC" in the site name', () => {
    expect(CLUB_SHORT_NAME).toBe('HCMUTE DSC');
    expect(SITE_NAME).toBe('HCMUTE DSC Learning Hub');
  });

  it('never shows "DSC" alone in the web app', () => {
    const offenders = sourceFiles(SRC).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line, i) => ({ line, at: `${relative(SRC, file)}:${i + 1}` }))
        .filter(({ line }) => LONE_DSC.test(line) && !COMMENT.test(line))
        .map(({ at, line }) => `${at}: ${line.trim()}`),
    );
    expect(offenders).toEqual([]);
  });
});
