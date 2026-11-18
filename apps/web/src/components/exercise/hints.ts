import type { ExerciseHints, ExerciseState } from '@hub/shared';

/**
 * What the hints panel says about the next hint (PRD F11). Pure so it has a test; the API
 * enforces the same rules (apps/api submissions/hints.ts), this only explains them.
 */
export type NextHintStatus =
  | { kind: 'none' }
  | { kind: 'ready'; position: number; label: string }
  | { kind: 'waiting'; position: number; reason: string };

export function nextHintStatus(
  hints: ExerciseHints,
  member: { attempts: number; state: ExerciseState },
): NextHintStatus {
  const next = hints.next;
  if (!next) return { kind: 'none' };
  const label = `Mở gợi ý ${next.position}/${hints.total}`;
  if (next.ready) return { kind: 'ready', position: next.position, label };
  if (member.state === 'locked') {
    return {
      kind: 'waiting',
      position: next.position,
      reason: 'Hoàn thành các bài tiên quyết để mở gợi ý.',
    };
  }
  const left = next.cost - member.attempts;
  return {
    kind: 'waiting',
    position: next.position,
    reason: `Gợi ý ${next.position} mở được sau ${next.cost} lần nộp (còn ${left} lần).`,
  };
}
