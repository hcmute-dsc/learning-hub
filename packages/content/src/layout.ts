/**
 * Where files live in a content repo (CONTENT-SPECIFICATION §1). This is the ONLY
 * place that knows the folder layout: change it here if the layout ever changes.
 *
 *   tracks/<track>/track.yaml
 *   tracks/<track>/modules/<module>/module.yaml
 *   tracks/<track>/modules/<module>/lessons/<lesson>.md
 *   tracks/<track>/modules/<module>/exercises/<exercise>/exercise.yaml
 *   tracks/<track>/modules/<module>/exercises/<exercise>/statement.md
 */

export const layout = {
  trackFile: (trackDir: string) => `${trackDir}/track.yaml`,
  moduleDir: (trackDir: string, name: string) => `${trackDir}/modules/${name}`,
  moduleFile: (moduleDir: string) => `${moduleDir}/module.yaml`,
  lessonFile: (moduleDir: string, name: string) => `${moduleDir}/lessons/${name}.md`,
  exerciseDir: (moduleDir: string, name: string) => `${moduleDir}/exercises/${name}`,
  exerciseFile: (exerciseDir: string) => `${exerciseDir}/exercise.yaml`,
  statementFile: (exerciseDir: string) => `${exerciseDir}/statement.md`,
};

export const LAYOUT_PATTERNS = {
  track: /^tracks\/[^/]+\/track\.yaml$/,
  module: /^tracks\/[^/]+\/modules\/[^/]+\/module\.yaml$/,
  lesson: /^tracks\/[^/]+\/modules\/[^/]+\/lessons\/[^/]+\.md$/,
  exercise: /^tracks\/[^/]+\/modules\/[^/]+\/exercises\/[^/]+\/exercise\.yaml$/,
};

/** Parent folder of a path: `a/b/c.yaml` → `a/b` */
export const dirOf = (path: string) => path.slice(0, path.lastIndexOf('/'));

/** Logical id used in prerequisites: `<track-slug>/<module-slug>/<item-slug>` */
export const itemRef = (trackSlug: string, moduleSlug: string, slug: string) =>
  `${trackSlug}/${moduleSlug}/${slug}`;
