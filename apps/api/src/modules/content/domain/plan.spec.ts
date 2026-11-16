import { parseContent, readDirectory, type ContentTree } from '@hub/content';
import { resolve } from 'node:path';
import type { DbItem, DbSnapshot } from './plan';
import { planChanges } from './plan';

const example = (): ContentTree => {
  const { tree, issues } = parseContent(
    readDirectory(resolve(__dirname, '../../../../../../content-example')),
  );
  expect(issues).toEqual([]);
  return tree;
};

const empty = (): DbSnapshot => ({ track: [], module: [], lesson: [], exercise: [] });

/** The catalog exactly as it would be after publishing `tree`. */
function snapshotOf(tree: ContentTree): DbSnapshot {
  const db = empty();
  for (const t of tree.tracks) {
    db.track.push({
      id: t.uid,
      parentId: null,
      slug: t.slug,
      status: t.status,
      contentHash: t.hash,
      sourcePath: t.sourcePath,
    });
    for (const m of t.modules) {
      db.module.push({
        id: m.uid,
        parentId: t.uid,
        slug: m.slug,
        status: 'active',
        contentHash: m.hash,
        sourcePath: m.sourcePath,
      });
      for (const l of m.lessons)
        db.lesson.push({
          id: l.uid,
          parentId: m.uid,
          slug: l.slug,
          status: 'active',
          contentHash: l.hash,
          sourcePath: l.sourcePath,
        });
      for (const e of m.exercises)
        db.exercise.push({
          id: e.uid,
          parentId: m.uid,
          slug: e.slug,
          status: 'active',
          contentHash: e.hash,
          sourcePath: e.sourcePath,
        });
    }
  }
  return db;
}

describe('planChanges', () => {
  it('adds everything to an empty catalog', () => {
    const plan = planChanges(example(), empty());
    expect(plan.conflicts).toEqual([]);
    expect(plan.diff.track).toEqual({ added: 2, changed: 0, removed: 0, unchanged: 0 });
    expect(plan.diff.exercise.added).toBe(4);
    expect(plan.upsert.lesson.size).toBe(3);
  });

  it('is a no-op when the catalog already matches', () => {
    const tree = example();
    const plan = planChanges(tree, snapshotOf(tree));
    expect(Object.values(plan.upsert).every((s) => s.size === 0)).toBe(true);
    expect(plan.diff.lesson).toEqual({ added: 0, changed: 0, removed: 0, unchanged: 3 });
  });

  it('updates only the item whose content changed', () => {
    const tree = example();
    const db = snapshotOf(tree);
    const lesson = db.lesson[0];
    lesson.contentHash = 'old';
    const plan = planChanges(tree, db);
    expect([...plan.upsert.lesson]).toEqual([lesson.id]);
    expect(plan.diff.lesson.changed).toBe(1);
    expect(plan.upsert.track.size).toBe(0);
  });

  it('archives active items that disappeared, and ignores ones already archived', () => {
    const tree = example();
    const db = snapshotOf(tree);
    const gone: DbItem = {
      id: 'gone-1',
      parentId: db.module[0].id,
      slug: 'old-lesson',
      status: 'active',
      contentHash: 'x',
      sourcePath: 'x.md',
    };
    const alreadyArchived: DbItem = { ...gone, id: 'gone-2', slug: 'older', status: 'archived' };
    db.lesson.push(gone, alreadyArchived);
    const plan = planChanges(tree, db);
    expect(plan.archive.lesson).toEqual(['gone-1']);
    expect(plan.diff.lesson.removed).toBe(1);
  });

  it('restores an archived item that comes back', () => {
    const tree = example();
    const db = snapshotOf(tree);
    db.exercise[0].status = 'archived';
    const plan = planChanges(tree, db);
    expect(plan.upsert.exercise.has(db.exercise[0].id)).toBe(true);
    expect(plan.diff.exercise.changed).toBe(1);
  });

  it('reports a changed uid as a conflict instead of creating a duplicate', () => {
    const tree = example();
    const db = snapshotOf(tree);
    const track = db.track.find((t) => t.slug === 'sql-sample')!;
    track.id = '00000000-0000-7000-8000-000000000999'; // the DB knows this slug under another uid
    const plan = planChanges(tree, db);
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0]).toMatchObject({ path: 'tracks/sql-sample/track.yaml' });
    expect(plan.conflicts[0].message).toContain('already belongs to');
  });

  it('allows a slug to move between items that are both in the tree (swap)', () => {
    const tree = example();
    const db = snapshotOf(tree);
    const [a, b] = tree.tracks[0].modules[0].lessons;
    const [ra, rb] = [
      db.lesson.find((l) => l.id === a.uid)!,
      db.lesson.find((l) => l.id === b.uid)!,
    ];
    [ra.slug, rb.slug] = [rb.slug, ra.slug];
    expect(planChanges(tree, db).conflicts).toEqual([]);
  });
});
