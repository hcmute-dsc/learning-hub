import type { ExerciseType, TrackLevel, TrackSummary } from '@hub/shared';
import type { ExerciseContext, LessonContext, OutlineItem, StoredHint } from './catalog.reader';

/**
 * Pure mappers from database rows to what the catalog returns (CONTRIBUTING rule 3:
 * rules without a database, so they can be unit-tested). The rows are typed by the
 * fields used here only; Prisma results fit them structurally.
 */

interface Source {
  sourceRepo: string;
  commitSha: string;
  /** registry versions only (DECISIONS ADR-10): where each track was read from, by slug */
  trackSources?: unknown;
}

/**
 * Repo and commit to link to for one track of a version. A registry version
 * (`sourceRepo` = learning-hub-content) knows each track's own repo; any other version,
 * or a track missing from the map, falls back to the version's own repo and commit.
 */
export function sourceFor(version: Source, trackSlug: string): { repo: string; commitSha: string } {
  const own = (version.trackSources as Record<string, unknown> | null | undefined)?.[trackSlug];
  if (
    own &&
    typeof own === 'object' &&
    typeof (own as { repo?: unknown }).repo === 'string' &&
    typeof (own as { commitSha?: unknown }).commitSha === 'string'
  ) {
    const { repo, commitSha } = own as { repo: string; commitSha: string };
    return { repo, commitSha };
  }
  return { repo: version.sourceRepo, commitSha: version.commitSha };
}

interface TrackRow {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  level: string;
  language: string;
  estHours: number | null;
  tags: string[];
}

export interface TrackSummaryRow extends TrackRow {
  /** active modules only, with counts of their active lessons and exercises */
  modules: { _count: { lessons: number; exercises: number } }[];
}

export function toTrackSummary(t: TrackSummaryRow): TrackSummary {
  return {
    id: t.id,
    slug: t.slug,
    title: t.title,
    summary: t.summary,
    level: t.level as TrackLevel,
    language: t.language,
    estHours: t.estHours,
    tags: t.tags,
    lessonCount: t.modules.reduce((n, m) => n + m._count.lessons, 0),
    exerciseCount: t.modules.reduce((n, m) => n + m._count.exercises, 0),
  };
}

export interface TrackDetailRow extends TrackRow {
  starterRepo: string | null;
  sourcePath: string;
  /** the version that last wrote this track row */
  contentVersion: Source;
  modules: {
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    lessons: { id: string; slug: string; title: string; estMinutes: number | null }[];
    exercises: { id: string; slug: string; title: string; type: string; difficulty: string }[];
  }[];
}

/**
 * Track page data. `source` is the version members are reading now (`published`), not
 * `track.contentVersion`: that one only moves when the track row itself changes, so after a
 * publish that changed lessons only, the page showed an old commit (learning-hub#8).
 * Before the first publish there is no published version, so the track's own version is used.
 */
export function toTrackDetail(track: TrackDetailRow, published: Source | null) {
  const source = sourceFor(published ?? track.contentVersion, track.slug);
  return {
    id: track.id,
    slug: track.slug,
    title: track.title,
    summary: track.summary,
    level: track.level,
    language: track.language,
    estHours: track.estHours,
    tags: track.tags,
    starterRepo: track.starterRepo,
    source: { ...source, path: track.sourcePath },
    modules: track.modules.map((m) => ({
      id: m.id,
      slug: m.slug,
      title: m.title,
      summary: m.summary,
      lessons: m.lessons,
      exercises: m.exercises,
    })),
  };
}

export interface OutlineRow {
  modules: {
    slug: string;
    lessons: { id: string; title: string }[];
    exercises: { id: string; title: string }[];
  }[];
}

/** Reading order: modules in order; inside a module, its lessons first, then its exercises. */
export function toOutlineItems(track: OutlineRow): OutlineItem[] {
  return track.modules.flatMap((m) => [
    ...m.lessons.map((l) => ({
      kind: 'lesson' as const,
      id: l.id,
      title: l.title,
      moduleSlug: m.slug,
    })),
    ...m.exercises.map((e) => ({
      kind: 'exercise' as const,
      id: e.id,
      title: e.title,
      moduleSlug: m.slug,
    })),
  ]);
}

interface ModuleWithTrack {
  slug: string;
  title: string;
  track: { id: string; slug: string; title: string; starterRepo: string | null };
}

export interface LessonRow {
  id: string;
  slug: string;
  title: string;
  bodyMd: string;
  estMinutes: number | null;
  sourcePath: string;
  module: ModuleWithTrack;
  /** the version that last wrote this lesson; only used before the first publish */
  contentVersion: Source;
  /** active exercises linked to this lesson, by position */
  exercises: { id: string; title: string; type: string }[];
}

/**
 * Lesson page data. Like `toTrackDetail`, `source` is the version members are reading now
 * (`published`), not `lesson.contentVersion`: that one only moves when the lesson itself
 * changes, so after the move to a registry the edit link and images of every unchanged
 * lesson still pointed at the old content repo (learning-hub#20). The published commit
 * holds the same file, because a lesson is only rewritten when a publish changes it.
 */
export function toLessonContext(lesson: LessonRow, published: Source | null = null): LessonContext {
  const { module } = lesson;
  return {
    id: lesson.id,
    slug: lesson.slug,
    title: lesson.title,
    bodyMd: lesson.bodyMd,
    estMinutes: lesson.estMinutes,
    sourcePath: lesson.sourcePath,
    track: { id: module.track.id, slug: module.track.slug, title: module.track.title },
    module: { slug: module.slug, title: module.title },
    source: sourceFor(published ?? lesson.contentVersion, module.track.slug),
    exercises: lesson.exercises.map((e) => ({
      id: e.id,
      title: e.title,
      type: e.type as ExerciseType,
    })),
  };
}

export interface ExerciseRow {
  id: string;
  slug: string;
  title: string;
  type: string;
  difficulty: string;
  statementMd: string;
  spec: unknown;
  hints: unknown;
  solutionMd: string | null;
  mentorNotesMd: string | null;
  requiresReview: boolean;
  contentVersionId: string;
  module: ModuleWithTrack;
  lesson: { id: string; title: string; status: string } | null;
  prerequisites: { requiredExercise: { id: string; title: string; status: string } }[];
}

export function toExerciseContext(exercise: ExerciseRow): ExerciseContext {
  const { module } = exercise;
  return {
    id: exercise.id,
    slug: exercise.slug,
    title: exercise.title,
    type: exercise.type as ExerciseType,
    difficulty: exercise.difficulty as ExerciseContext['difficulty'],
    statementMd: exercise.statementMd,
    spec: exercise.spec as Record<string, unknown>,
    hints: toStoredHints(exercise.hints),
    solutionMd: exercise.solutionMd,
    mentorNotesMd: exercise.mentorNotesMd,
    requiresReview: exercise.requiresReview,
    contentVersionId: exercise.contentVersionId,
    track: {
      id: module.track.id,
      slug: module.track.slug,
      title: module.track.title,
      starterRepo: module.track.starterRepo,
    },
    module: { slug: module.slug, title: module.title },
    // An archived lesson is hidden from members, so the exercise no longer links to it.
    lesson:
      exercise.lesson && exercise.lesson.status === 'active'
        ? { id: exercise.lesson.id, title: exercise.lesson.title }
        : null,
    // An archived prerequisite no longer locks anything.
    prerequisites: exercise.prerequisites
      .map((p) => p.requiredExercise)
      .filter((r) => r.status === 'active')
      .map((r) => ({ id: r.id, title: r.title })),
  };
}

/**
 * Read `exercises.hints` (JSON written at publish). Malformed entries are dropped instead of
 * failing the whole exercise page, and the result is sorted by position.
 */
export function toStoredHints(value: unknown): StoredHint[] {
  if (!Array.isArray(value)) return [];
  const hints: StoredHint[] = [];
  for (const entry of value) {
    const { position, cost, bodyMd } = (entry ?? {}) as Partial<StoredHint>;
    if (Number.isInteger(position) && Number.isInteger(cost) && typeof bodyMd === 'string') {
      hints.push({ position: position!, cost: cost!, bodyMd });
    }
  }
  return hints.sort((a, b) => a.position - b.position);
}

/** exerciseId → ids of its prerequisites; every asked id is present, even with none. */
export function groupPrerequisites(
  exerciseIds: string[],
  rows: { exerciseId: string; requiredExerciseId: string }[],
): Map<string, string[]> {
  const map = new Map<string, string[]>(exerciseIds.map((id) => [id, []]));
  for (const r of rows) map.get(r.exerciseId)?.push(r.requiredExerciseId);
  return map;
}
