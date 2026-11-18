import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTitle, MAX_LENGTH } from './pr-title.mjs';

test('accepts titles in the house format', () => {
  for (const title of [
    'Catalog: show the published commit on the track page',
    'CI: scan for secrets and check module boundaries',
    'Web: /contribute page for lessons, new tracks and code',
    'Ops: new-track relies on the org-level GitHub App values',
    'Revert "Web: /contribute page for lessons"',
  ]) {
    assert.deepEqual(checkTitle(title), [], title);
  }
});

test('rejects titles without an area', () => {
  assert.equal(checkTitle('fix the track page').length, 1);
  assert.equal(checkTitle('catalog: lowercase area').length, 1);
  assert.equal(checkTitle('Catalog:missing space').length, 1);
  assert.equal(checkTitle('feat(web): conventional commit style').length, 1);
});

test('rejects empty titles', () => {
  assert.deepEqual(checkTitle(''), ['The title is empty.']);
  assert.deepEqual(checkTitle('   '), ['The title is empty.']);
});

test('rejects titles that are too long', () => {
  const title = 'Web: ' + 'a'.repeat(MAX_LENGTH);
  assert.match(checkTitle(title)[0], /at most 72/);
});

test('rejects WIP and a trailing full stop', () => {
  assert.equal(checkTitle('Web: WIP contribute page').length, 1);
  assert.equal(checkTitle('Web: contribute page wip').length, 1);
  assert.equal(checkTitle('Web: add the contribute page.').length, 1);
});
