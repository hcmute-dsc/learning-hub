import type { ExerciseHints, ExerciseState, Role } from '@hub/shared';
import { DomainError } from '../../common/errors';
import type { StoredHint } from '../catalog/catalog.reader';

/**
 * Pure rules for progressive hints and reference solutions (PRD F11, SECURITY §2).
 * Kept free of Nest and Prisma so the "never leak an unopened hint or an early solution"
 * rules have plain unit tests.
 *
 * Hints open one by one, in order. A hint's `cost` is soft: the member needs that many
 * attempts before opening it, and opening never lowers a score (it is only counted).
 */

/** The first hint the member has not opened yet, or null when all are open. */
export function nextHint(hints: StoredHint[], opened: ReadonlySet<number>): StoredHint | null {
  return hints.find((h) => !opened.has(h.position)) ?? null;
}

/** What the member sees: the text of opened hints only, and whether the next one can be opened. */
export function toHintsView(
  hints: StoredHint[],
  member: { opened: ReadonlySet<number>; attempts: number; state: ExerciseState },
): ExerciseHints {
  const next = nextHint(hints, member.opened);
  return {
    total: hints.length,
    opened: hints
      .filter((h) => member.opened.has(h.position))
      .map((h) => ({ position: h.position, bodyMd: h.bodyMd })),
    next: next && {
      position: next.position,
      cost: next.cost,
      ready: member.state !== 'locked' && member.attempts >= next.cost,
    },
  };
}

/**
 * May the member open hint `position` now? `already` = it was opened before (opening is
 * idempotent, the button may be clicked twice). Throws a 404/409 DomainError otherwise.
 */
export function checkHintOpen(input: {
  position: number;
  hints: StoredHint[];
  opened: ReadonlySet<number>;
  attempts: number;
  state: ExerciseState;
}): { hint: StoredHint; already: boolean } {
  const hint = input.hints.find((h) => h.position === input.position);
  if (!hint) throw DomainError.notFound('Hint');
  if (input.opened.has(hint.position)) return { hint, already: true };

  if (input.state === 'locked') {
    throw DomainError.conflict('Bài tập đang bị khóa: hãy hoàn thành các bài yêu cầu trước.');
  }
  const next = nextHint(input.hints, input.opened);
  if (next && next.position !== hint.position) {
    throw DomainError.conflict(`Hãy mở gợi ý ${next.position} trước.`);
  }
  if (input.attempts < hint.cost) {
    throw DomainError.conflict(
      `Gợi ý này mở được sau ${hint.cost} lần nộp (bạn đã nộp ${input.attempts} lần).`,
    );
  }
  return { hint, already: false };
}

/**
 * SECURITY §2: the reference solution is for members who completed the exercise (passed,
 * or approved when it needs a review; decided by the club on learning-hub#53), and for
 * mentors/admins who review it. A failed or waiting attempt is not enough.
 */
export function canSeeSolution(viewer: { roles: Role[] }, state: ExerciseState): boolean {
  return state === 'completed' || viewer.roles.includes('mentor') || viewer.roles.includes('admin');
}

/** null when the exercise has no solution; the text only once it is unlocked. */
export function toSolutionView(
  solutionMd: string | null,
  unlocked: boolean,
): { unlocked: boolean; bodyMd: string | null } | null {
  if (solutionMd === null) return null;
  return { unlocked, bodyMd: unlocked ? solutionMd : null };
}
