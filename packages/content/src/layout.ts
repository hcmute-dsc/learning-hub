/**
 * Where files live in a content repo (CONTENT-SPECIFICATION §1). This is the ONLY
 * place that knows the folder layout: change it here if the layout ever changes.
 *
 *   tracks/<track>/track.yaml
 *   tracks/<track>/docs/setup.md          (optional) how to install the tools for this track
 *   tracks/<track>/docs/resources.md      (optional) extra reading for this track
 *   tracks/<track>/glossary.yaml          (optional) English words of the track (§3.1c)
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
  trackDocsDir: (trackDir: string) => `${trackDir}/docs/`,
  trackDocFile: (trackDir: string, page: TrackDocPage) => `${trackDir}/docs/${page}.md`,
  glossaryFile: (trackDir: string) => `${trackDir}/glossary.yaml`,
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

/**
 * Optional track-level pages (CONTENT-SPECIFICATION §3.1b, learning-hub#44): "Cài đặt"
 * (install the tools, check your work locally) and "Tài liệu thêm" (extra reading).
 */
export const TRACK_DOC_PAGES = ['setup', 'resources'] as const;
export type TrackDocPage = (typeof TRACK_DOC_PAGES)[number];

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

/**
 * Anchor of a glossary term on the "Từ vựng" page (`#pull-request`), and the key that
 * `see:` and a lesson's `terms:` are matched by: case and punctuation do not matter, so
 * `Pull request` and `pull-request` are the same term (§3.1c).
 */
export const glossaryAnchor = (term: string) =>
  term
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

/** Parent folder of a path: `a/b/c.yaml` → `a/b` */
export const dirOf = (path: string) => path.slice(0, path.lastIndexOf('/'));

/** Logical id used in prerequisites: `<track-slug>/<module-slug>/<item-slug>` */
export const itemRef = (trackSlug: string, moduleSlug: string, slug: string) =>
  `${trackSlug}/${moduleSlug}/${slug}`;
