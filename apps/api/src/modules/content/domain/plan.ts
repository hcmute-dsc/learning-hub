import type { ContentIssue, ContentTree } from '@hub/content';
import type { CatalogChanges, DbSnapshot, ItemKind } from '../../catalog/catalog.types';

export type { DbItem, DbSnapshot, ItemKind } from '../../catalog/catalog.types';

export interface DiffCount {
  added: number;
  changed: number;
  removed: number;
  unchanged: number;
}

export interface ChangePlan extends CatalogChanges {
  diff: Record<ItemKind, DiffCount>;
  /** problems that only show up against the database (natural-key clashes) */
  conflicts: ContentIssue[];
}

interface TreeItem {
  id: string;
  parentId: string | null;
  slug: string;
  status: string;
  hash: string;
  sourcePath: string;
}

function flatten(tree: ContentTree): Record<ItemKind, TreeItem[]> {
  const out: Record<ItemKind, TreeItem[]> = { track: [], module: [], lesson: [], exercise: [] };
  for (const t of tree.tracks) {
    out.track.push({
      id: t.uid,
      parentId: null,
      slug: t.slug,
      status: t.status,
      hash: t.hash,
      sourcePath: t.sourcePath,
    });
    for (const m of t.modules) {
      out.module.push({
        id: m.uid,
        parentId: t.uid,
        slug: m.slug,
        status: 'active',
        hash: m.hash,
        sourcePath: m.sourcePath,
      });
      for (const l of m.lessons)
        out.lesson.push({
          id: l.uid,
          parentId: m.uid,
          slug: l.slug,
          status: 'active',
          hash: l.hash,
          sourcePath: l.sourcePath,
        });
      for (const e of m.exercises)
        out.exercise.push({
          id: e.uid,
          parentId: m.uid,
          slug: e.slug,
          status: 'active',
          hash: e.hash,
          sourcePath: e.sourcePath,
        });
    }
  }
  return out;
}

const KINDS: ItemKind[] = ['track', 'module', 'lesson', 'exercise'];

/**
 * Compare a validated content tree with the catalog (CONTENT-SPECIFICATION §5).
 * Pure function: the caller loads the snapshot and applies the plan in one transaction.
 */
export function planChanges(tree: ContentTree, db: DbSnapshot): ChangePlan {
  const items = flatten(tree);
  const plan: ChangePlan = {
    upsert: { track: new Set(), module: new Set(), lesson: new Set(), exercise: new Set() },
    archive: { track: [], module: [], lesson: [], exercise: [] },
    diff: {
      track: { added: 0, changed: 0, removed: 0, unchanged: 0 },
      module: { added: 0, changed: 0, removed: 0, unchanged: 0 },
      lesson: { added: 0, changed: 0, removed: 0, unchanged: 0 },
      exercise: { added: 0, changed: 0, removed: 0, unchanged: 0 },
    },
    conflicts: [],
  };

  for (const kind of KINDS) {
    const byId = new Map(db[kind].map((r) => [r.id, r]));
    const byKey = new Map(db[kind].map((r) => [`${r.parentId ?? ''}/${r.slug}`, r]));
    const treeIds = new Set(items[kind].map((i) => i.id));

    for (const item of items[kind]) {
      // Same place + slug but a different uid: usually someone regenerated the uid.
      const clash = byKey.get(`${item.parentId ?? ''}/${item.slug}`);
      if (clash && clash.id !== item.id && !treeIds.has(clash.id)) {
        plan.conflicts.push({
          path: item.sourcePath,
          message: `${kind} slug "${item.slug}" already belongs to ${clash.id} (${clash.sourcePath}). Keep that uid, or use a new slug.`,
        });
        continue;
      }
      const row = byId.get(item.id);
      if (!row) {
        plan.diff[kind].added += 1;
        plan.upsert[kind].add(item.id);
      } else if (
        row.contentHash !== item.hash ||
        row.status !== item.status ||
        row.parentId !== item.parentId ||
        row.sourcePath !== item.sourcePath
      ) {
        plan.diff[kind].changed += 1;
        plan.upsert[kind].add(item.id);
      } else {
        plan.diff[kind].unchanged += 1;
      }
    }

    for (const row of db[kind]) {
      if (row.status === 'active' && !treeIds.has(row.id)) {
        plan.diff[kind].removed += 1;
        plan.archive[kind].push(row.id);
      }
    }
  }
  return plan;
}
