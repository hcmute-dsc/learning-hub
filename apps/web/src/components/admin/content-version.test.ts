import { describe, expect, it } from 'vitest';
import type { ContentVersionSummary } from '@hub/shared';
import { commitUrl, diffRows, diffShort, shortSha, versionActions } from './content-version';

const SHA = 'a'.repeat(40);
const zero = { added: 0, changed: 0, removed: 0, unchanged: 0 };

describe('commitUrl', () => {
  it('links GitHub owner/repo sources', () => {
    expect(commitUrl('hcmute-dsc/learning-hub-content', SHA)).toBe(
      `https://github.com/hcmute-dsc/learning-hub-content/commit/${SHA}`,
    );
  });

  it('has no link for a local folder', () => {
    expect(commitUrl('local:content-example', SHA)).toBeNull();
    expect(commitUrl('D:/repos/content', SHA)).toBeNull();
    expect(commitUrl('/srv/content/x', SHA)).toBeNull();
  });
});

describe('shortSha', () => {
  it('keeps 7 characters', () => {
    expect(shortSha('0123456789abcdef')).toBe('0123456');
  });
});

describe('diffRows / diffShort', () => {
  const summary: ContentVersionSummary = {
    diff: {
      track: { ...zero, unchanged: 1 },
      module: { ...zero, added: 1 },
      lesson: { added: 2, changed: 1, removed: 0, unchanged: 5 },
      exercise: { ...zero, removed: 1 },
    },
  };

  it('lists kinds in catalog order with Vietnamese labels', () => {
    expect(diffRows(summary)?.map((r) => r.label)).toEqual([
      'Lộ trình',
      'Chương',
      'Bài học',
      'Bài tập',
    ]);
  });

  it('sums the changes', () => {
    expect(diffShort(summary)).toBe('+3 · ~1 · −1');
  });

  it('handles invalid content and no changes', () => {
    expect(diffRows({ diff: null })).toBeNull();
    expect(diffShort({})).toBe('—');
    expect(diffShort({ diff: { track: zero, module: zero, lesson: zero, exercise: zero } })).toBe(
      'Không đổi',
    );
  });
});

describe('versionActions', () => {
  it('offers publish/reject on drafts and restore on superseded versions, to admins', () => {
    expect(versionActions('draft', true)).toEqual(['publish', 'reject']);
    expect(versionActions('superseded', true)).toEqual(['restore']);
    expect(versionActions('published', true)).toEqual([]);
    expect(versionActions('rejected', true)).toEqual([]);
  });

  it('offers nothing to content maintainers (the API allows only admins)', () => {
    expect(versionActions('draft', false)).toEqual([]);
  });
});
