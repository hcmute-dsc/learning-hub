#!/usr/bin/env node
/**
 * Validate a content checkout: `hub-content-validate [dir]` (default: current directory).
 * Exit code 1 when there are issues, so it can gate PRs in learning-hub-content.
 */
import { resolve } from 'node:path';
import { parseContent } from './parse';
import { readDirectory } from './read-directory';

const root = resolve(process.argv[2] ?? '.');
const { tree, issues } = parseContent(readDirectory(root));

const counts = tree.tracks.reduce(
  (c, t) => {
    c.tracks += 1;
    for (const m of t.modules) {
      c.modules += 1;
      c.lessons += m.lessons.length;
      c.exercises += m.exercises.length;
    }
    return c;
  },
  { tracks: 0, modules: 0, lessons: 0, exercises: 0 },
);

if (issues.length) {
  for (const i of issues) console.error(`✗ ${i.path}: ${i.message}`);
  console.error(`\n${issues.length} problem(s) found in ${root}`);
  process.exit(1);
}
console.log(
  `✓ ${counts.tracks} tracks, ${counts.modules} modules, ${counts.lessons} lessons, ${counts.exercises} exercises — all valid`,
);
