import { dirOf, itemRef, LAYOUT_PATTERNS } from './layout';
import type { ContentIssue, ContentTree, ExerciseNode } from './types';

/**
 * Checks that need the whole tree, run after every file was parsed on its own:
 *   1. orphan files     — exist but are not listed, so they would never be published
 *   2. unique ids/slugs — uid unique everywhere, slug unique inside its parent
 *   3. references       — `lesson:` and `prerequisites:` point to things that exist,
 *                         and `code` exercises have a starter repo on their track
 *   4. no cycles        — exercise prerequisites form a DAG
 *
 * `earlier` = issues found while parsing. Files that already have a problem are not
 * reported again as orphans.
 */
export function findCrossFileProblems(
  files: ReadonlyMap<string, string>,
  tree: ContentTree,
  earlier: ContentIssue[],
): ContentIssue[] {
  return [
    ...findOrphans([...files.keys()], tree, earlier),
    ...findDuplicates(tree),
    ...findBrokenReferences(tree),
    ...findPrerequisiteCycles(tree),
  ];
}

/** `<track>/<module>/<slug>` → exercise. Used to turn prerequisites into uids. */
export function exerciseIndex(tree: ContentTree): Map<string, ExerciseNode> {
  const index = new Map<string, ExerciseNode>();
  for (const t of tree.tracks)
    for (const m of t.modules)
      for (const e of m.exercises) index.set(itemRef(t.slug, m.slug, e.slug), e);
  return index;
}

// ------------------------------------------------------------------ 1. orphans

function findOrphans(paths: string[], tree: ContentTree, earlier: ContentIssue[]): ContentIssue[] {
  const issues: ContentIssue[] = [];

  const listed = new Set<string>();
  for (const t of tree.tracks)
    for (const m of t.modules) {
      listed.add(m.sourcePath);
      m.lessons.forEach((l) => listed.add(l.sourcePath));
      m.exercises.forEach((e) => listed.add(e.sourcePath));
    }

  const hasIssue = new Set(earlier.map((i) => i.path));
  // When a track.yaml or module.yaml is broken, we could not read its list,
  // so the files below it are not orphans: fixing that one file is enough.
  const brokenParents = earlier
    .filter((i) => /\/(track|module)\.yaml$/.test(i.path))
    .map((i) => dirOf(i.path) + '/');
  const existingTracks = new Set(paths.filter((p) => LAYOUT_PATTERNS.track.test(p)).map(dirOf));

  for (const path of paths) {
    const isListable =
      LAYOUT_PATTERNS.module.test(path) ||
      LAYOUT_PATTERNS.lesson.test(path) ||
      LAYOUT_PATTERNS.exercise.test(path);
    if (!isListable || listed.has(path) || hasIssue.has(path)) continue;
    if (brokenParents.some((dir) => path.startsWith(dir) && path !== dir)) continue;

    const trackDir = path.split('/').slice(0, 2).join('/');
    issues.push(
      existingTracks.has(trackDir)
        ? { path, message: 'not listed in its track.yaml/module.yaml (orphan file)' }
        : { path, message: `${trackDir}/track.yaml is missing` },
    );
  }
  return issues;
}

// ------------------------------------------------------------------ 2. duplicates

function findDuplicates(tree: ContentTree): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const uidOwner = new Map<string, string>();

  const claimUid = (uid: string, path: string) => {
    const owner = uidOwner.get(uid);
    if (owner) issues.push({ path, message: `uid ${uid} is already used by ${owner}` });
    else uidOwner.set(uid, path);
  };

  /** Reports a slug seen twice among siblings. One instance per parent. */
  const slugChecker = (kind: string, scope: string) => {
    const owners = new Map<string, string>();
    return (slug: string, path: string) => {
      const owner = owners.get(slug);
      if (owner)
        issues.push({
          path,
          message: `${kind} slug "${slug}" is already used by ${owner} in this ${scope}`,
        });
      else owners.set(slug, path);
    };
  };

  const trackSlug = slugChecker('track', 'repo');
  for (const t of tree.tracks) {
    claimUid(t.uid, t.sourcePath);
    trackSlug(t.slug, t.sourcePath);

    const moduleSlug = slugChecker('module', 'track');
    for (const m of t.modules) {
      claimUid(m.uid, m.sourcePath);
      moduleSlug(m.slug, m.sourcePath);

      const lessonSlug = slugChecker('lesson', 'module');
      for (const l of m.lessons) {
        claimUid(l.uid, l.sourcePath);
        lessonSlug(l.slug, l.sourcePath);
      }
      const exerciseSlug = slugChecker('exercise', 'module');
      for (const e of m.exercises) {
        claimUid(e.uid, e.sourcePath);
        exerciseSlug(e.slug, e.sourcePath);
      }
    }
  }
  return issues;
}

// ------------------------------------------------------------------ 3. references

function findBrokenReferences(tree: ContentTree): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const exercises = exerciseIndex(tree);
  const lessons = new Set<string>();
  for (const t of tree.tracks)
    for (const m of t.modules)
      for (const l of m.lessons) lessons.add(itemRef(t.slug, m.slug, l.slug));

  for (const t of tree.tracks)
    for (const m of t.modules) {
      const lessonSlugsHere = new Set(m.lessons.map((l) => l.slug));

      // A lesson may require a lesson or an exercise (shown as a recommendation).
      for (const l of m.lessons)
        for (const ref of l.prerequisites)
          if (!lessons.has(ref) && !exercises.has(ref))
            issues.push({ path: l.sourcePath, message: `prerequisite "${ref}" does not exist` });

      // An exercise may only require exercises (that is what locks it).
      for (const e of m.exercises) {
        if (e.type === 'code' && !t.starterRepo)
          issues.push({
            path: e.sourcePath,
            message: `code exercises need \`starterRepo\` in ${t.sourcePath}`,
          });
        if (e.lessonSlug && !lessonSlugsHere.has(e.lessonSlug))
          issues.push({
            path: e.sourcePath,
            message: `lesson "${e.lessonSlug}" is not in this module`,
          });
        for (const ref of e.prerequisites)
          if (!exercises.has(ref))
            issues.push({
              path: e.sourcePath,
              message: `prerequisite "${ref}" is not an exercise`,
            });
      }
    }
  return issues;
}

// ------------------------------------------------------------------ 4. cycles

/** Depth-first search; a node met again while still "in progress" closes a cycle. */
function findPrerequisiteCycles(tree: ContentTree): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const exercises = exerciseIndex(tree);
  const state = new Map<string, 'in-progress' | 'done'>();

  const visit = (ref: string, path: string[]): void => {
    if (state.get(ref) === 'done') return;
    if (state.get(ref) === 'in-progress') {
      const cycle = [...path.slice(path.indexOf(ref)), ref].join(' → ');
      issues.push({
        path: exercises.get(ref)!.sourcePath,
        message: `prerequisite cycle: ${cycle}`,
      });
      return;
    }
    state.set(ref, 'in-progress');
    for (const next of exercises.get(ref)!.prerequisites)
      if (exercises.has(next)) visit(next, [...path, ref]);
    state.set(ref, 'done');
  };

  for (const ref of exercises.keys()) visit(ref, []);
  return issues;
}
