import { parse as parseYaml, YAMLParseError } from 'yaml';
import type { ZodError } from 'zod';
import { findCrossFileProblems } from './checks';
import { contentHash } from './hash';
import { dirOf, HINT_FILE, layout, LAYOUT_PATTERNS, MAX_HINTS, PUBLIC_SOLUTION } from './layout';
import { checkMarkdown, splitFrontMatter } from './markdown';
import {
  exerciseFileSchema,
  hintFrontMatterSchema,
  lessonFrontMatterSchema,
  moduleFileSchema,
  SPEC_SCHEMAS,
  trackFileSchema,
} from './schemas';
import type {
  ContentIssue,
  ExerciseNode,
  HintNode,
  LessonNode,
  ModuleNode,
  ParseResult,
  TrackNode,
} from './types';

/** path (relative, forward slashes) → UTF-8 text. Only files under tracks/ are read. */
export type FileMap = ReadonlyMap<string, string>;

export interface ParseOptions {
  /**
   * Files of the private checker repo (CONTENT-SPECIFICATION §3.8), keyed like
   * `exercises/<track>/<exercise>/solution.md`. Only the API passes them; the public
   * content repo's CLI and CI never see solutions.
   */
  solutions?: FileMap;
}

/** Shared by the parse steps below: the files, and where problems are collected. */
interface Context {
  files: FileMap;
  issues: ContentIssue[];
}

/**
 * Parse and validate a whole content repo.
 *
 * It never throws for content problems: every problem becomes an issue with its
 * file path, so a contributor sees all of them in one run (CONTENT-SPECIFICATION §4).
 * If `issues` is not empty, the tree may be incomplete and must not be published.
 *
 * Steps: track.yaml → module.yaml → lessons + exercises → cross-file checks.
 */
export function parseContent(files: FileMap, options: ParseOptions = {}): ParseResult {
  const ctx: Context = { files, issues: [] };
  for (const path of files.keys()) {
    if (PUBLIC_SOLUTION.test(path)) {
      ctx.issues.push({
        path,
        message:
          'solutions must not be in the public content repo; put them in the private checker repo (CONTENT-SPECIFICATION §3.8)',
      });
    }
  }
  const trackFiles = [...files.keys()].filter((p) => LAYOUT_PATTERNS.track.test(p)).sort();

  const tracks: TrackNode[] = [];
  for (const trackPath of trackFiles) {
    const track = parseTrack(ctx, trackPath);
    if (track) tracks.push(track);
  }

  const tree = { tracks };
  if (options.solutions) attachSolutions(ctx, tree, options.solutions);
  ctx.issues.push(...findCrossFileProblems(files, tree, ctx.issues));
  return { tree, issues: unique(ctx.issues) };
}

// ------------------------------------------------------------------ one function per file type

function parseTrack(ctx: Context, trackPath: string): TrackNode | null {
  const data = readYamlFile(ctx, trackPath, trackFileSchema);
  if (!data) return null;

  const { modules: moduleNames, ...trackFields } = data;
  const track: TrackNode = {
    uid: data.uid,
    slug: data.slug,
    title: data.title,
    summary: data.summary,
    language: data.language,
    level: data.level,
    estHours: data.estimatedHours ?? null,
    tags: data.tags,
    position: data.position,
    status: data.status,
    outcomes: data.outcomes,
    maintainers: data.maintainers,
    license: data.license,
    starterRepo: data.starterRepo ?? null,
    sourcePath: trackPath,
    hash: contentHash(trackFields), // the module list is hashed in each module
    modules: [],
  };

  // Position = order in track.yaml `modules:` (1-based), not the folder name.
  moduleNames.forEach((name, index) => {
    const module = parseModule(ctx, layout.moduleDir(dirOf(trackPath), name), index + 1);
    if (module) track.modules.push(module);
  });
  return track;
}

function parseModule(ctx: Context, moduleDir: string, position: number): ModuleNode | null {
  const modulePath = layout.moduleFile(moduleDir);
  const data = readYamlFile(ctx, modulePath, moduleFileSchema);
  if (!data) return null;

  const module: ModuleNode = {
    uid: data.uid,
    slug: data.slug,
    title: data.title,
    summary: data.summary ?? null,
    position,
    sourcePath: modulePath,
    hash: contentHash({
      uid: data.uid,
      slug: data.slug,
      title: data.title,
      summary: data.summary,
      position,
    }),
    lessons: [],
    exercises: [],
  };

  data.lessons.forEach((name, index) => {
    const lesson = parseLesson(ctx, modulePath, layout.lessonFile(moduleDir, name), index + 1);
    if (lesson) module.lessons.push(lesson);
  });
  data.exercises.forEach((name, index) => {
    const exercise = parseExercise(ctx, modulePath, layout.exerciseDir(moduleDir, name), index + 1);
    if (exercise) module.exercises.push(exercise);
  });
  return module;
}

function parseLesson(
  ctx: Context,
  modulePath: string,
  lessonPath: string,
  position: number,
): LessonNode | null {
  const text = ctx.files.get(lessonPath);
  if (text === undefined) {
    ctx.issues.push({ path: modulePath, message: `lists a lesson, but ${lessonPath} is missing` });
    return null;
  }
  const { data: frontMatter, body } = splitFrontMatter(text);
  if (frontMatter === null) {
    ctx.issues.push({ path: lessonPath, message: 'missing front matter (--- ... ---)' });
    return null;
  }
  const data = parseYamlText(ctx, lessonPath, frontMatter, lessonFrontMatterSchema, 'front matter');
  if (!data) return null;
  checkMarkdown(lessonPath, body, ctx.issues);

  const lesson: Omit<LessonNode, 'hash'> = {
    uid: data.uid,
    slug: data.slug,
    title: data.title,
    bodyMd: body.trim(),
    estMinutes: data.estimatedMinutes ?? null,
    objectives: data.objectives,
    prerequisites: data.prerequisites,
    position,
    sourcePath: lessonPath,
  };
  return { ...lesson, hash: contentHash(lesson) };
}

function parseExercise(
  ctx: Context,
  modulePath: string,
  exerciseDir: string,
  position: number,
): ExerciseNode | null {
  const exercisePath = layout.exerciseFile(exerciseDir);
  if (!ctx.files.has(exercisePath)) {
    ctx.issues.push({
      path: modulePath,
      message: `lists an exercise, but ${exercisePath} is missing`,
    });
    return null;
  }
  const data = readYamlFile(ctx, exercisePath, exerciseFileSchema);
  if (!data) return null;

  // `spec` has a different shape for each exercise type.
  const spec = SPEC_SCHEMAS[data.type].safeParse(data.spec ?? {});
  if (!spec.success) {
    ctx.issues.push(...zodIssues(exercisePath, spec.error, 'spec.'));
    return null;
  }

  const statementPath = layout.statementFile(exerciseDir);
  const statement = ctx.files.get(statementPath);
  if (statement === undefined) {
    ctx.issues.push({ path: exercisePath, message: `${statementPath} is missing` });
    return null;
  }
  checkMarkdown(statementPath, statement, ctx.issues);

  const exercise: Omit<ExerciseNode, 'hash'> = {
    uid: data.uid,
    slug: data.slug,
    title: data.title,
    type: data.type,
    difficulty: data.difficulty,
    lessonSlug: data.lesson ?? null,
    statementMd: statement.trim(),
    spec: spec.data as Record<string, unknown>,
    requiresReview: data.requiresReview ?? data.type === 'project',
    prerequisites: data.prerequisites,
    tags: data.tags,
    hints: parseHints(ctx, exerciseDir),
    solutionMd: null, // filled from the checker repo by attachSolutions
    mentorNotesMd: parseMentorNotes(ctx, exerciseDir),
    position,
    sourcePath: exercisePath,
  };
  return { ...exercise, hash: exerciseHash(exercise) };
}

/**
 * Hash of an exercise. Empty hints, a missing solution and missing mentor notes are left
 * out, so exercises written before these existed keep their hash and are not reported as changed.
 */
function exerciseHash(exercise: Omit<ExerciseNode, 'hash'> & { hash?: string }): string {
  const { hash: _hash, hints, solutionMd, mentorNotesMd, ...rest } = exercise;
  return contentHash({
    ...rest,
    ...(hints.length > 0 && { hints }),
    ...(solutionMd !== null && { solutionMd }),
    ...(mentorNotesMd !== null && { mentorNotesMd }),
  });
}

/**
 * Optional `mentor-notes.md` (§3.10): plain Markdown, no front matter. The content repo is
 * public, so these notes are too; the API only hides them from the member UI.
 */
function parseMentorNotes(ctx: Context, exerciseDir: string): string | null {
  const path = layout.mentorNotesFile(exerciseDir);
  const text = ctx.files.get(path);
  if (text === undefined) return null;
  if (splitFrontMatter(text).data !== null) {
    ctx.issues.push({ path, message: 'mentor-notes.md takes no front matter' });
    return null;
  }
  if (!text.trim()) {
    ctx.issues.push({ path, message: 'mentor-notes.md is empty; delete it or write the notes' });
    return null;
  }
  checkMarkdown(path, text, ctx.issues);
  return text.trim();
}

/** `hints/01.md`, `hints/02.md`… (§3.7). Numbered from 01 without gaps; front matter optional. */
function parseHints(ctx: Context, exerciseDir: string): HintNode[] {
  const dir = layout.hintsDir(exerciseDir);
  const paths = [...ctx.files.keys()].filter((p) => p.startsWith(dir)).sort();
  const hints: HintNode[] = [];
  for (const path of paths) {
    const match = HINT_FILE.exec(path.slice(dir.length));
    if (!match) {
      ctx.issues.push({ path, message: 'hint files must be named NN.md (01.md, 02.md, …)' });
      continue;
    }
    const { data: frontMatter, body } = splitFrontMatter(ctx.files.get(path)!);
    const data =
      frontMatter === null
        ? hintFrontMatterSchema.parse({})
        : parseYamlText(ctx, path, frontMatter, hintFrontMatterSchema, 'front matter');
    if (!data) continue;
    if (!body.trim()) {
      ctx.issues.push({ path, message: 'hint is empty' });
      continue;
    }
    checkMarkdown(path, body, ctx.issues);
    hints.push({ position: Number(match[1]), cost: data.cost, bodyMd: body.trim() });
  }

  if (hints.length > MAX_HINTS) {
    ctx.issues.push({ path: dir, message: `at most ${MAX_HINTS} hints per exercise` });
  }
  hints.forEach((hint, index) => {
    if (hint.position !== index + 1) {
      ctx.issues.push({
        path: `${dir}${String(hint.position).padStart(2, '0')}.md`,
        message: `hints must be numbered 01, 02, … without gaps (expected ${String(index + 1).padStart(2, '0')}.md)`,
      });
    }
  });
  return hints;
}

/**
 * Give each exercise its solution from the checker repo: `exercises/<track>/<exercise>/solution.md`
 * (§3.8). Files for exercises that are not in the tree (tests only, or retired) are ignored.
 */
function attachSolutions(ctx: Context, tree: { tracks: TrackNode[] }, solutions: FileMap): void {
  const owners = new Map<string, ExerciseNode[]>();
  for (const t of tree.tracks)
    for (const m of t.modules)
      for (const e of m.exercises) {
        const key = layout.solutionFile(t.slug, e.slug);
        owners.set(key, [...(owners.get(key) ?? []), e]);
      }

  for (const [path, text] of solutions) {
    const exercises = LAYOUT_PATTERNS.solution.test(path) ? owners.get(path) : undefined;
    if (!exercises || !text.trim()) continue;
    if (exercises.length > 1) {
      ctx.issues.push({
        path,
        message: `${exercises.length} exercises of this track share the slug, so the solution is ambiguous; give them different slugs`,
      });
      continue;
    }
    checkMarkdown(path, text, ctx.issues);
    const exercise = exercises[0];
    exercise.solutionMd = text.trim();
    exercise.hash = exerciseHash(exercise);
  }
}

// ------------------------------------------------------------------ YAML + Zod helpers

interface Schema<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false; error: ZodError };
}

/** Read a YAML file and validate it. Returns null (and records issues) when anything is wrong. */
function readYamlFile<T>(ctx: Context, path: string, schema: Schema<T>): T | null {
  const text = ctx.files.get(path);
  if (text === undefined) {
    ctx.issues.push({ path, message: 'file is missing' });
    return null;
  }
  return parseYamlText(ctx, path, text, schema, 'YAML');
}

function parseYamlText<T>(
  ctx: Context,
  path: string,
  text: string,
  schema: Schema<T>,
  what: string,
): T | null {
  let raw: unknown;
  try {
    raw = parseYaml(text);
  } catch (e) {
    const line = e instanceof YAMLParseError && e.linePos ? ` (line ${e.linePos[0].line})` : '';
    ctx.issues.push({ path, message: `invalid ${what}${line}: ${firstLine(e)}` });
    return null;
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    ctx.issues.push(...zodIssues(path, result.error));
    return null;
  }
  return result.data;
}

function zodIssues(path: string, error: ZodError, prefix = ''): ContentIssue[] {
  return error.issues.map((issue) => ({
    path,
    message: `${prefix}${issue.path.length ? issue.path.join('.') + ': ' : ''}${issue.message}`,
  }));
}

const firstLine = (e: unknown) => (e as Error).message.split('\n')[0];

function unique(issues: ContentIssue[]): ContentIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.path}\u0000${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
