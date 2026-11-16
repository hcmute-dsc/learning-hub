import { Injectable } from '@nestjs/common';
import type { ExerciseState, SubmissionStatus } from '@hub/shared';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CatalogReader } from '../catalog/catalog.reader';
import { exerciseState } from './exercise-state';

/**
 * Exercise states for one member, for many exercises at once (one query each for
 * exercises, prerequisites and submissions). Used by the learning module for
 * progress and by the submissions module itself. Prerequisites are evaluated one
 * level deep: "met" = every prerequisite exercise is completed.
 */
@Injectable()
export class ExerciseStateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogReader,
  ) {}

  async statesFor(userId: string, exerciseIds: string[]): Promise<Map<string, ExerciseState>> {
    if (!exerciseIds.length) return new Map();
    const prerequisites = await this.catalog.prerequisiteMap(exerciseIds);
    const allIds = [...new Set([...exerciseIds, ...[...prerequisites.values()].flat()])];

    const [exercises, submissions] = await Promise.all([
      this.prisma.exercise.findMany({
        where: { id: { in: allIds } },
        select: { id: true, requiresReview: true },
      }),
      this.prisma.submission.findMany({
        where: { userId, exerciseId: { in: allIds } },
        orderBy: { submittedAt: 'desc' },
        select: { exerciseId: true, status: true },
      }),
    ]);

    const statusesOf = (id: string) =>
      submissions.filter((s) => s.exerciseId === id).map((s) => s.status as SubmissionStatus);
    const requiresReview = new Map(exercises.map((e) => [e.id, e.requiresReview]));
    const isCompleted = (id: string) =>
      exerciseState({
        requiresReview: requiresReview.get(id) ?? false,
        statuses: statusesOf(id),
        prerequisitesMet: true,
      }) === 'completed';

    return new Map(
      exerciseIds.map((id) => [
        id,
        exerciseState({
          requiresReview: requiresReview.get(id) ?? false,
          statuses: statusesOf(id),
          prerequisitesMet: (prerequisites.get(id) ?? []).every(isCompleted),
        }),
      ]),
    );
  }

  async stateOf(userId: string, exerciseId: string): Promise<ExerciseState> {
    return (await this.statesFor(userId, [exerciseId])).get(exerciseId)!;
  }
}
