// PR title check (CONTRIBUTING "Commits" and "Pull request"): the title becomes the
// squash commit on main, so it must read `Area: imperative summary`, at most 72 characters.
// Runs in CI, so nobody needs a local commit hook.
//
// Run: PR_TITLE="Catalog: show the published commit" node scripts/pr-title.mjs

import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAX_LENGTH = 72;

// One area word: `API`, `Web`, `CI`, `Content`… Letters, digits and hyphens.
const FORMAT = /^([A-Z][A-Za-z0-9-]*): (\S.*)$/;
// GitHub's own revert button makes `Revert "<original title>"`.
const REVERT = /^Revert ".+"$/;

/**
 * Problems with a PR title; an empty list means the title is fine.
 * @param {string} title
 * @returns {string[]}
 */
export function checkTitle(title) {
  const problems = [];
  const trimmed = (title ?? '').trim();
  if (trimmed === '') return ['The title is empty.'];
  if (trimmed.length > MAX_LENGTH) {
    problems.push(`The title has ${trimmed.length} characters; keep it at most ${MAX_LENGTH}.`);
  }
  if (REVERT.test(trimmed)) return problems;

  const match = FORMAT.exec(trimmed);
  if (!match) {
    problems.push(
      'Use `Area: imperative summary`, e.g. `Catalog: show the published commit on the track page`.',
    );
    return problems;
  }
  const summary = match[2];
  if (/^wip\b/i.test(summary) || /\bwip$/i.test(summary)) {
    problems.push('Remove "WIP": open the PR as a draft instead.');
  }
  if (summary.endsWith('.')) {
    problems.push('Drop the full stop at the end of the summary.');
  }
  return problems;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const title = process.env.PR_TITLE ?? '';
  const problems = checkTitle(title);
  if (problems.length > 0) {
    console.error(`PR title: ${JSON.stringify(title)}`);
    for (const problem of problems) console.error(`- ${problem}`);
    console.error('See CONTRIBUTING.md, "Commits". Edit the title; this check runs again.');
    process.exit(1);
  }
  console.log(`PR title OK: ${title}`);
}
