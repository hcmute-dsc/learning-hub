import { Injectable } from '@nestjs/common';
import type { ExerciseType } from '@hub/shared';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { DomainError } from '../../common/errors';

/**
 * Read models used by the learning and submissions modules (E4/E5).
 * Only `active` content is returned; archived items behave as "not found".
 * Content is small (one track ≈ 70 items), so these queries load whole outlines.
 */

/** One step of a track in reading order: per module, lessons first, then exercises. */
export interface OutlineItem {
  kind: 'lesson' | 'exercise';
  id: string;
  title: string;
  moduleSlug: string;
}

export interface TrackOutline {
  id: string;
  slug: string;
  title: string;
  items: OutlineItem[];
}

export interface LessonContext {
  id: string;
  slug: string;
  title: string;
  bodyMd: string;
  estMinutes: number | null;
  sourcePath: string;
  track: { id: string; slug: string; title: string };
  module: { slug: string; title: string };
  source: { repo: string; commitSha: string };
  /** exercises whose `lesson:` is this lesson, by position */
  exercises: { id: string; title: string; type: ExerciseType }[];
}

export interface ExerciseContext {
  id: string;
  slug: string;
  title: string;
  type: ExerciseType;
  difficulty: 'easy' | 'medium' | 'hard';
  statementMd: string;
  /** validated by @hub/content at publish time; shape depends on `type` */
  spec: Record<string, unknown>;
  requiresReview: boolean;
  contentVersionId: string;
  track: { id: string; slug: string; title: string; starterRepo: string | null };
  module: { slug: string; title: string };
  lesson: { id: string; title: string } | null;
  /** prerequisite exercises (must be completed first) */
  prerequisites: { id: string; title: string }[];
}

@Injectable()
export class CatalogReader {
  constructor(private readonly prisma: PrismaService) {}

  /** All active lessons and exercises of a track, in reading order. */
  async trackOutline(where: { id: string } | { slug: string }): Promise<TrackOutline> {
    const track = await this.prisma.track.findFirst({
      where: { ...where, status: 'active' },
      include: {
        modules: {
          where: { status: 'active' },
          orderBy: { position: 'asc' },
          include: {
            lessons: {
              where: { status: 'active' },
              orderBy: { position: 'asc' },
              select: { id: true, title: true },
            },
            exercises: {
              where: { status: 'active' },
              orderBy: { position: 'asc' },
              select: { id: true, title: true },
            },
          },
        },
      },
    });
    if (!track) throw DomainError.notFound('Track');
    const items: OutlineItem[] = track.modules.flatMap((m) => [
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
    return { id: track.id, slug: track.slug, title: track.title, items };
  }

  async lesson(id: string): Promise<LessonContext> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id, status: 'active', module: { status: 'active', track: { status: 'active' } } },
      include: {
        module: { include: { track: true } },
        contentVersion: { select: { sourceRepo: true, commitSha: true } },
        exercises: {
          where: { status: 'active' },
          orderBy: { position: 'asc' },
          select: { id: true, title: true, type: true },
        },
      },
    });
    if (!lesson) throw DomainError.notFound('Lesson');
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
      source: {
        repo: lesson.contentVersion.sourceRepo,
        commitSha: lesson.contentVersion.commitSha,
      },
      exercises: lesson.exercises.map((e) => ({
        id: e.id,
        title: e.title,
        type: e.type as ExerciseType,
      })),
    };
  }

  async exercise(id: string): Promise<ExerciseContext> {
    const exercise = await this.prisma.exercise.findFirst({
      where: { id, status: 'active', module: { status: 'active', track: { status: 'active' } } },
      include: {
        module: { include: { track: true } },
        lesson: { select: { id: true, title: true, status: true } },
        prerequisites: {
          include: { requiredExercise: { select: { id: true, title: true, status: true } } },
        },
      },
    });
    if (!exercise) throw DomainError.notFound('Exercise');
    const { module } = exercise;
    return {
      id: exercise.id,
      slug: exercise.slug,
      title: exercise.title,
      type: exercise.type as ExerciseType,
      difficulty: exercise.difficulty as ExerciseContext['difficulty'],
      statementMd: exercise.statementMd,
      spec: exercise.spec as Record<string, unknown>,
      requiresReview: exercise.requiresReview,
      contentVersionId: exercise.contentVersionId,
      track: {
        id: module.track.id,
        slug: module.track.slug,
        title: module.track.title,
        starterRepo: module.track.starterRepo,
      },
      module: { slug: module.slug, title: module.title },
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

  /** exerciseId → ids of its active prerequisite exercises (for many exercises at once). */
  async prerequisiteMap(exerciseIds: string[]): Promise<Map<string, string[]>> {
    const rows = await this.prisma.exercisePrerequisite.findMany({
      where: { exerciseId: { in: exerciseIds }, requiredExercise: { status: 'active' } },
      select: { exerciseId: true, requiredExerciseId: true },
    });
    const map = new Map<string, string[]>(exerciseIds.map((id) => [id, []]));
    for (const r of rows) map.get(r.exerciseId)!.push(r.requiredExerciseId);
    return map;
  }

  /** exerciseId → requires_review, for many exercises at once (used by exercise states). */
  async reviewFlags(exerciseIds: string[]): Promise<Map<string, boolean>> {
    const rows = await this.prisma.exercise.findMany({
      where: { id: { in: exerciseIds } },
      select: { id: true, requiresReview: true },
    });
    return new Map(rows.map((e) => [e.id, e.requiresReview]));
  }
}
