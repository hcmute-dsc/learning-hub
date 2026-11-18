import { Injectable } from '@nestjs/common';
import type { ExerciseType } from '@hub/shared';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { DomainError } from '../../common/errors';
import {
  groupPrerequisites,
  sourceFor,
  toExerciseContext,
  toLessonContext,
  toOutlineItems,
} from './catalog-views';

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

/** A track and the content members read now: its repo and commit (certificates, F19). */
export interface TrackSource {
  id: string;
  slug: string;
  title: string;
  source: { repo: string; commitSha: string };
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
  /** every hint, opened or not: the submissions module decides what a member sees */
  hints: StoredHint[];
  /** reference solution (§3.8); never send it before the member may see it */
  solutionMd: string | null;
  contentVersionId: string;
  track: { id: string; slug: string; title: string; starterRepo: string | null };
  module: { slug: string; title: string };
  lesson: { id: string; title: string } | null;
  /** prerequisite exercises (must be completed first) */
  prerequisites: { id: string; title: string }[];
}

/** One entry of `exercises.hints`, written by CatalogWriter from `hints/NN.md`. */
export interface StoredHint {
  position: number;
  cost: number;
  bodyMd: string;
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
    const items = toOutlineItems(track);
    return { id: track.id, slug: track.slug, title: track.title, items };
  }

  async lesson(id: string): Promise<LessonContext> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id, status: 'active', module: { status: 'active', track: { status: 'active' } } },
      include: {
        module: { include: { track: true } },
        contentVersion: { select: { sourceRepo: true, commitSha: true, trackSources: true } },
        exercises: {
          where: { status: 'active' },
          orderBy: { position: 'asc' },
          select: { id: true, title: true, type: true },
        },
      },
    });
    if (!lesson) throw DomainError.notFound('Lesson');
    const published = await this.prisma.contentVersion.findFirst({
      where: { status: 'published' },
      select: { sourceRepo: true, commitSha: true, trackSources: true },
    });
    return toLessonContext(lesson, published);
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
    return toExerciseContext(exercise);
  }

  /** exerciseId → ids of its active prerequisite exercises (for many exercises at once). */
  async prerequisiteMap(exerciseIds: string[]): Promise<Map<string, string[]>> {
    const rows = await this.prisma.exercisePrerequisite.findMany({
      where: { exerciseId: { in: exerciseIds }, requiredExercise: { status: 'active' } },
      select: { exerciseId: true, requiredExerciseId: true },
    });
    return groupPrerequisites(exerciseIds, rows);
  }

  /** Active tracks, slug and title only, in catalog order (filter choices). */
  async activeTracks(): Promise<{ slug: string; title: string }[]> {
    return this.prisma.track.findMany({
      where: { status: 'active' },
      orderBy: [{ position: 'asc' }, { title: 'asc' }],
      select: { slug: true, title: true },
    });
  }

  /** exerciseId → requires_review, for many exercises at once (used by exercise states). */
  async reviewFlags(exerciseIds: string[]): Promise<Map<string, boolean>> {
    const rows = await this.prisma.exercise.findMany({
      where: { id: { in: exerciseIds } },
      select: { id: true, requiresReview: true },
    });
    return new Map(rows.map((e) => [e.id, e.requiresReview]));
  }

  /**
   * The track's title and the content commit members are reading now: the published
   * version (registry versions know each track's own repo, ADR-10), or the track's own
   * version before the first publish. Archived tracks are included: a certificate may
   * be issued for a completion stored before the track was archived.
   */
  async trackSource(trackId: string): Promise<TrackSource> {
    const track = await this.prisma.track.findUnique({
      where: { id: trackId },
      select: {
        id: true,
        slug: true,
        title: true,
        contentVersion: { select: { sourceRepo: true, commitSha: true, trackSources: true } },
      },
    });
    if (!track) throw DomainError.notFound('Track');
    const published = await this.prisma.contentVersion.findFirst({
      where: { status: 'published' },
      select: { sourceRepo: true, commitSha: true, trackSources: true },
    });
    return {
      id: track.id,
      slug: track.slug,
      title: track.title,
      source: sourceFor(published ?? track.contentVersion, track.slug),
    };
  }
}
