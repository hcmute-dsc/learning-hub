import type {
  ContentDiffCount,
  ContentItemKind,
  ContentVersionStatus,
  ContentVersionSummary,
} from '@hub/shared';

/** Pure helpers for /admin/content (tested in content-version.test.ts). */

export const VERSION_STATUS_LABEL: Record<ContentVersionStatus, string> = {
  draft: 'Bản nháp',
  published: 'Đang dùng',
  superseded: 'Bản cũ',
  rejected: 'Bị từ chối',
};

const KIND_LABEL: Record<ContentItemKind, string> = {
  track: 'Lộ trình',
  module: 'Chương',
  lesson: 'Bài học',
  exercise: 'Bài tập',
};

const KINDS: ContentItemKind[] = ['track', 'module', 'lesson', 'exercise'];

/** First 7 characters, like GitHub shows a commit. */
export const shortSha = (sha: string) => sha.slice(0, 7);

/**
 * Link to the commit on GitHub when the source is `owner/repo`. A local folder source
 * (development) has no page to link to.
 */
export function commitUrl(sourceRepo: string, sha: string): string | null {
  if (!/^[\w.-]+\/[\w.-]+$/.test(sourceRepo)) return null;
  return `https://github.com/${sourceRepo}/commit/${sha}`;
}

export interface DiffRow extends ContentDiffCount {
  kind: ContentItemKind;
  label: string;
}

/** One row per kind, in catalog order; null when the version has no diff (invalid content). */
export function diffRows(summary: ContentVersionSummary): DiffRow[] | null {
  if (!summary.diff) return null;
  const diff = summary.diff;
  return KINDS.map((kind) => ({
    kind,
    label: KIND_LABEL[kind],
    ...(diff[kind] ?? { added: 0, changed: 0, removed: 0, unchanged: 0 }),
  }));
}

/** "+3 · ~1 · −2" across all kinds, or "Không đổi" / "—" when there is nothing to show. */
export function diffShort(summary: ContentVersionSummary): string {
  const rows = diffRows(summary);
  if (!rows) return '—';
  let added = 0;
  let changed = 0;
  let removed = 0;
  for (const row of rows) {
    added += row.added;
    changed += row.changed;
    removed += row.removed;
  }
  if (!added && !changed && !removed) return 'Không đổi';
  return `+${added} · ~${changed} · −${removed}`;
}

export type VersionAction = 'publish' | 'restore' | 'reject';

/**
 * Buttons a version offers. Only admins publish or reject (the API's @Roles); a
 * superseded version was live before, so publishing it again is a rollback.
 */
export function versionActions(status: ContentVersionStatus, isAdmin: boolean): VersionAction[] {
  if (!isAdmin) return [];
  if (status === 'draft') return ['publish', 'reject'];
  if (status === 'superseded') return ['restore'];
  return [];
}
