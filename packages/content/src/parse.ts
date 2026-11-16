import { parse as parseYaml, YAMLParseError } from 'yaml';
import type { ZodError } from 'zod';
import { findCrossFileProblems } from './checks';
import { contentHash } from './hash';
import { dirOf, layout, LAYOUT_PATTERNS } from './layout';
import { checkMarkdown, splitFrontMatter } from './markdown';
import {
  exerciseFileSchema,
  lessonFrontMatterSchema,
  moduleFileSchema,
  SPEC_SCHEMAS,
  trackFileSchema,
} from './schemas';
import type {
  ContentIssue,
  ExerciseNode,
  LessonNode,
  ModuleNode,
  ParseResult,
  TrackNode,
} from './types';

/** path (relative, forward slashes) → UTF-8 text. Only files under tracks/ are read. */
export type FileMap = ReadonlyMap<string, string>;

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
export function parseContent(files: FileMap): ParseResult {
  const ctx: Context = { files, issues: [] };
  const trackFiles = [...files.keys()].filter((p) => LAYOUT_PATTERNS.track.test(p)).sort();

  const tracks: TrackNode[] = [];
  for (const trackPath of trackFiles) {
    const track = parseTrack(ctx, trackPath);
    if (track) tracks.push(track);
  }

  const tree = { tracks };
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
    position,
    sourcePath: exercisePath,
  };
  return { ...exercise, hash: contentHash(exercise) };
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
