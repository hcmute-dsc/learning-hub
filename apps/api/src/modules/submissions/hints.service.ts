import { Injectable } from '@nestjs/common';
import type { HintView } from '@hub/shared';
import type { AuthUser } from '../../common/auth.decorators';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CatalogReader } from '../catalog/catalog.reader';
import { ExerciseStateService } from './exercise-state.service';
import { checkHintOpen } from './hints';

/** Opening hints and remembering who opened which (table hint_unlocks, PRD F11). */
@Injectable()
export class HintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogReader,
    private readonly states: ExerciseStateService,
  ) {}

  /** Positions of the hints this member opened on this exercise. */
  async openedPositions(userId: string, exerciseId: string): Promise<Set<number>> {
    const rows = await this.prisma.hintUnlock.findMany({
      where: { userId, exerciseId },
      select: { position: true },
    });
    return new Set(rows.map((r) => r.position));
  }

  /** `created` is false when the member had already opened this hint. */
  async open(
    user: AuthUser,
    exerciseId: string,
    position: number,
  ): Promise<{ created: boolean; hint: HintView }> {
    const exercise = await this.catalog.exercise(exerciseId);
    const [state, attempts, opened] = await Promise.all([
      this.states.stateOf(user.id, exercise.id),
      this.prisma.submission.count({ where: { userId: user.id, exerciseId: exercise.id } }),
      this.openedPositions(user.id, exercise.id),
    ]);
    const { hint, already } = checkHintOpen({
      position,
      hints: exercise.hints,
      opened,
      attempts,
      state,
    });

    let created = false;
    if (!already) {
      // skipDuplicates: a double click that races past the check above still stores one row.
      const { count } = await this.prisma.hintUnlock.createMany({
        data: [{ userId: user.id, exerciseId: exercise.id, position: hint.position }],
        skipDuplicates: true,
      });
      created = count > 0;
    }
    return { created, hint: { position: hint.position, bodyMd: hint.bodyMd } };
  }
}
