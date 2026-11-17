import { Injectable } from '@nestjs/common';
import type { ExerciseState, SubmissionStatus } from '@hub/shared';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CatalogReader } from '../catalog/catalog.reader';
import { statesWithPrerequisites, type ExerciseStateWithLocks } from './exercise-state';

/**
 * Exercise states for one member, for many exercises at once (one query each for
 * prerequisites, review flags and submissions). Used by the learning module for
 * progress and by the submissions module itself. The rule itself is the pure
 * `statesWithPrerequisites` in exercise-state.ts; this class only loads data.
 */
@Injectable()
export class ExerciseStateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogReader,
  ) {}

  /** State and the prerequisites that lock it, per exercise id. */
  async detailsFor(
    userId: string,
    exerciseIds: string[],
  ): Promise<Map<string, ExerciseStateWithLocks>> {
    if (!exerciseIds.length) return new Map();
    const prerequisites = await this.catalog.prerequisiteMap(exerciseIds);
    const allIds = [...new Set([...exerciseIds, ...[...prerequisites.values()].flat()])];

    const [requiresReview, submissions] = await Promise.all([
      this.catalog.reviewFlags(allIds),
      this.prisma.submission.findMany({
        where: { userId, exerciseId: { in: allIds } },
        orderBy: { submittedAt: 'desc' },
        select: { exerciseId: true, status: true },
      }),
    ]);

    const submissionsById = new Map<string, SubmissionStatus[]>();
    for (const s of submissions) {
      const list = submissionsById.get(s.exerciseId) ?? [];
      list.push(s.status as SubmissionStatus);
      submissionsById.set(s.exerciseId, list);
    }
    return statesWithPrerequisites({
      ids: exerciseIds,
      prerequisites,
      requiresReview,
      submissionsById,
    });
  }

  async statesFor(userId: string, exerciseIds: string[]): Promise<Map<string, ExerciseState>> {
    const details = await this.detailsFor(userId, exerciseIds);
    const states = new Map<string, ExerciseState>();
    for (const [id, detail] of details) states.set(id, detail.state);
    return states;
  }

  async stateOf(userId: string, exerciseId: string): Promise<ExerciseState> {
    return (await this.statesFor(userId, [exerciseId])).get(exerciseId)!;
  }

  /**
   * For the member profile (learning module): when the member submitted anything, and
   * how many different exercises are completed by the same rule as everywhere else.
   */
  async activityOf(userId: string): Promise<{ submittedAt: Date[]; completedExercises: number }> {
    const rows = await this.prisma.submission.findMany({
      where: { userId },
      select: { exerciseId: true, submittedAt: true },
    });
    const exerciseIds = [...new Set(rows.map((r) => r.exerciseId))];
    const states = await this.statesFor(userId, exerciseIds);
    const completedExercises = [...states.values()].filter((st) => st === 'completed').length;
    return { submittedAt: rows.map((r) => r.submittedAt), completedExercises };
  }
}
