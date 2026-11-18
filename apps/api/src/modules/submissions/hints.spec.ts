import type { ExerciseState } from '@hub/shared';
import { DomainError } from '../../common/errors';
import { canSeeSolution, checkHintOpen, nextHint, toHintsView, toSolutionView } from './hints';

const hints = [
  { position: 1, cost: 0, bodyMd: 'one' },
  { position: 2, cost: 1, bodyMd: 'two' },
  { position: 3, cost: 3, bodyMd: 'three' },
];

function open(over: {
  position: number;
  opened?: number[];
  attempts?: number;
  state?: ExerciseState;
}) {
  return checkHintOpen({
    hints,
    position: over.position,
    opened: new Set(over.opened ?? []),
    attempts: over.attempts ?? 0,
    state: over.state ?? 'not_started',
  });
}

function refusal(run: () => unknown): { status: number; message: string } {
  try {
    run();
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    return { status: (e as DomainError).status, message: (e as DomainError).message };
  }
  throw new Error('expected a DomainError');
}

describe('checkHintOpen', () => {
  it('opens the first hint without attempts when its cost is 0', () => {
    expect(open({ position: 1 })).toEqual({ hint: hints[0], already: false });
  });

  it('opens hints only in order', () => {
    expect(refusal(() => open({ position: 2 }))).toEqual({
      status: 409,
      message: 'Hãy mở gợi ý 1 trước.',
    });
    expect(open({ position: 2, opened: [1], attempts: 1 }).already).toBe(false);
  });

  it('needs `cost` attempts before a hint opens', () => {
    expect(refusal(() => open({ position: 2, opened: [1], attempts: 0 })).message).toContain(
      'sau 1 lần nộp',
    );
    expect(refusal(() => open({ position: 3, opened: [1, 2], attempts: 2 })).status).toBe(409);
    expect(open({ position: 3, opened: [1, 2], attempts: 3 }).hint.bodyMd).toBe('three');
  });

  it('refuses a locked exercise', () => {
    expect(refusal(() => open({ position: 1, state: 'locked' })).message).toContain('khóa');
  });

  it('is idempotent for a hint already opened, even when locked now', () => {
    expect(open({ position: 1, opened: [1], state: 'locked' })).toEqual({
      hint: hints[0],
      already: true,
    });
  });

  it('is a 404 for a hint that does not exist', () => {
    expect(refusal(() => open({ position: 4 })).status).toBe(404);
  });

  it('still allows opening hints after the exercise is completed', () => {
    expect(open({ position: 1, state: 'completed' }).already).toBe(false);
  });
});

describe('toHintsView', () => {
  it('carries the text of opened hints only', () => {
    const view = toHintsView(hints, { opened: new Set([1]), attempts: 0, state: 'attempted' });
    expect(view).toEqual({
      total: 3,
      opened: [{ position: 1, bodyMd: 'one' }],
      next: { position: 2, cost: 1, ready: false },
    });
    expect(JSON.stringify(view)).not.toMatch(/two|three/);
  });

  it('marks the next hint not ready on a locked exercise', () => {
    expect(toHintsView(hints, { opened: new Set(), attempts: 5, state: 'locked' }).next).toEqual({
      position: 1,
      cost: 0,
      ready: false,
    });
  });

  it('has no next hint when all are open', () => {
    const all = new Set([1, 2, 3]);
    expect(toHintsView(hints, { opened: all, attempts: 3, state: 'completed' }).next).toBeNull();
    expect(nextHint(hints, all)).toBeNull();
  });

  it('ignores opened positions that no longer exist after a content change', () => {
    expect(
      toHintsView(hints.slice(0, 1), { opened: new Set([1, 2]), attempts: 0, state: 'attempted' })
        .opened,
    ).toEqual([{ position: 1, bodyMd: 'one' }]);
  });
});

describe('solution access (SECURITY §2)', () => {
  it('needs a first attempt for members', () => {
    expect(canSeeSolution({ roles: ['member'] }, 0)).toBe(false);
    expect(canSeeSolution({ roles: ['member'] }, 1)).toBe(true);
  });

  it('is always open to mentors and admins, not to content maintainers', () => {
    expect(canSeeSolution({ roles: ['member', 'mentor'] }, 0)).toBe(true);
    expect(canSeeSolution({ roles: ['admin'] }, 0)).toBe(true);
    expect(canSeeSolution({ roles: ['member', 'content_maintainer'] }, 0)).toBe(false);
  });

  it('hides the text until unlocked, and is null without a solution', () => {
    expect(toSolutionView('S', false)).toEqual({ unlocked: false, bodyMd: null });
    expect(toSolutionView('S', true)).toEqual({ unlocked: true, bodyMd: 'S' });
    expect(toSolutionView(null, true)).toBeNull();
  });
});
