/**
 * Where files live in a content repo (CONTENT-SPECIFICATION §1). This is the ONLY
 * place that knows the folder layout: change it here if the layout ever changes.
 *
 *   tracks/<track>/track.yaml
 *   tracks/<track>/modules/<module>/module.yaml
 *   tracks/<track>/modules/<module>/lessons/<lesson>.md
 *   tracks/<track>/modules/<module>/exercises/<exercise>/exercise.yaml
 *   tracks/<track>/modules/<module>/exercises/<exercise>/statement.md
 *   tracks/<track>/modules/<module>/exercises/<exercise>/hints/NN.md
 *   tracks/<track>/modules/<module>/exercises/<exercise>/mentor-notes.md   (optional, mentors only)
 *
 * Reference solutions are NOT in the content repo (it is public). They live in the
 * private checker repo (§3.8):
 *
 *   exercises/<track>/<exercise>/solution.md
 */

export const layout = {
  trackFile: (trackDir: string) => `${trackDir}/track.yaml`,
  moduleDir: (trackDir: string, name: string) => `${trackDir}/modules/${name}`,
  moduleFile: (moduleDir: string) => `${moduleDir}/module.yaml`,
  lessonFile: (moduleDir: string, name: string) => `${moduleDir}/lessons/${name}.md`,
  exerciseDir: (moduleDir: string, name: string) => `${moduleDir}/exercises/${name}`,
  exerciseFile: (exerciseDir: string) => `${exerciseDir}/exercise.yaml`,
  statementFile: (exerciseDir: string) => `${exerciseDir}/statement.md`,
  hintsDir: (exerciseDir: string) => `${exerciseDir}/hints/`,
  /** Shown to mentors and admins on the review page only. Public in the repo (§3.10). */
  mentorNotesFile: (exerciseDir: string) => `${exerciseDir}/mentor-notes.md`,
  /** In the checker repo, not the content repo. */
  solutionFile: (trackSlug: string, exerciseSlug: string) =>
    `exercises/${trackSlug}/${exerciseSlug}/solution.md`,
};

/** `hints/01.md` … `hints/99.md`: the number is the order members open them in. */
export const HINT_FILE = /^(\d{2})\.md$/;
export const MAX_HINTS = 10;

/** A solution in the public content repo would be readable by everyone (§3.8). */
export const PUBLIC_SOLUTION =
  /^tracks\/[^/]+\/modules\/[^/]+\/exercises\/[^/]+\/solutions?(\.md|\/)/i;

export const LAYOUT_PATTERNS = {
  track: /^tracks\/[^/]+\/track\.yaml$/,
  module: /^tracks\/[^/]+\/modules\/[^/]+\/module\.yaml$/,
  lesson: /^tracks\/[^/]+\/modules\/[^/]+\/lessons\/[^/]+\.md$/,
  exercise: /^tracks\/[^/]+\/modules\/[^/]+\/exercises\/[^/]+\/exercise\.yaml$/,
  /** checker repo */
  solution: /^exercises\/[^/]+\/[^/]+\/solution\.md$/,
};

/** Parent folder of a path: `a/b/c.yaml` → `a/b` */
export const dirOf = (path: string) => path.slice(0, path.lastIndexOf('/'));

/** Logical id used in prerequisites: `<track-slug>/<module-slug>/<item-slug>` */
export const itemRef = (trackSlug: string, moduleSlug: string, slug: string) =>
  `${trackSlug}/${moduleSlug}/${slug}`;
