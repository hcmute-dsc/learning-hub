import type { ExerciseState, LessonStatus } from '@hub/shared';
import type { OutlineItem } from '../catalog/catalog.reader';
import {
  completedModules,
  enrollmentStatus,
  isAllDone,
  neighbours,
  nextItem,
  percentOf,
  shouldMarkCompleted,
  summarize,
} from './progress';

const lesson = (id: string): OutlineItem => ({ kind: 'lesson', id, title: id, moduleSlug: 'm' });
const exercise = (id: string): OutlineItem => ({
  kind: 'exercise',
  id,
  title: id,
  moduleSlug: 'm',
});

const items = [lesson('l1'), exercise('e1'), lesson('l2'), exercise('e2')];

function statuses(
  lessons: Record<string, LessonStatus> = {},
  exercises: Record<string, ExerciseState> = {},
) {
  return {
    lessons: new Map(Object.entries(lessons)),
    exercises: new Map(Object.entries(exercises)),
  };
}

describe('percentOf', () => {
  it('rounds the share of done items and is 0 for an empty track', () => {
    expect(percentOf({ done: 1, total: 2 }, { done: 0, total: 1 })).toBe(33);
    expect(percentOf({ done: 2, total: 3 }, { done: 0, total: 0 })).toBe(67);
    expect(percentOf({ done: 0, total: 0 }, { done: 0, total: 0 })).toBe(0);
  });

  it('never shows 100 while an item is left', () => {
    expect(percentOf({ done: 199, total: 200 }, { done: 0, total: 0 })).toBe(99);
    expect(percentOf({ done: 200, total: 200 }, { done: 0, total: 0 })).toBe(100);
  });
});

describe('isAllDone', () => {
  it('needs every item done and at least one item', () => {
    expect(isAllDone({ done: 199, total: 200 }, { done: 0, total: 0 })).toBe(false);
    expect(isAllDone({ done: 2, total: 2 }, { done: 1, total: 1 })).toBe(true);
    expect(isAllDone({ done: 0, total: 0 }, { done: 0, total: 0 })).toBe(false);
  });
});

describe('summarize', () => {
  it('counts lessons and exercises separately', () => {
    const s = summarize(
      items,
      statuses({ l1: 'completed', l2: 'in_progress' }, { e1: 'completed', e2: 'attempted' }),
    );
    expect(s.lessons).toEqual({ done: 1, total: 2 });
    expect(s.exercises).toEqual({ done: 1, total: 2 });
    expect(s.percent).toBe(50);
    expect(s.next).toEqual({ kind: 'lesson', id: 'l2', title: 'l2' });
  });

  it('is 100% with no next item when everything is done', () => {
    const s = summarize(
      items,
      statuses({ l1: 'completed', l2: 'completed' }, { e1: 'completed', e2: 'completed' }),
    );
    expect(s.percent).toBe(100);
    expect(s.next).toBeNull();
  });
});

describe('nextItem', () => {
  it('starts at the first item for a new member', () => {
    expect(nextItem(items, statuses())).toEqual({ kind: 'lesson', id: 'l1', title: 'l1' });
  });

  it('skips locked exercises', () => {
    const s = statuses({ l1: 'completed' }, { e1: 'locked' });
    expect(nextItem(items, s)?.id).toBe('l2');
  });

  it('returns the first locked exercise when only locked ones are left', () => {
    const s = statuses({ l1: 'completed', l2: 'completed' }, { e1: 'locked', e2: 'locked' });
    expect(nextItem(items, s)?.id).toBe('e1');
  });

  it('is null for an empty track', () => {
    expect(nextItem([], statuses())).toBeNull();
  });

  it('returns an exercise that is attempted but not completed', () => {
    const s = statuses({ l1: 'completed' }, { e1: 'needs_changes' });
    expect(nextItem(items, s)?.id).toBe('e1');
  });
});

describe('enrollment completion', () => {
  it('shows completed when every item is done or when already stored as completed', () => {
    expect(enrollmentStatus('active', true)).toBe('completed');
    expect(enrollmentStatus('completed', false)).toBe('completed');
    expect(enrollmentStatus('active', false)).toBe('active');
  });

  it('marks completed only once, and only for active enrollments', () => {
    expect(shouldMarkCompleted('active', true)).toBe(true);
    expect(shouldMarkCompleted('completed', true)).toBe(false);
    expect(shouldMarkCompleted('active', false)).toBe(false);
    expect(shouldMarkCompleted('dropped', true)).toBe(false);
  });
});

describe('neighbours', () => {
  it('finds previous and next in reading order', () => {
    expect(neighbours(items, 'e1')).toEqual({
      previous: { kind: 'lesson', id: 'l1', title: 'l1' },
      next: { kind: 'lesson', id: 'l2', title: 'l2' },
    });
    expect(neighbours(items, 'l1').previous).toBeNull();
    expect(neighbours(items, 'e2').next).toBeNull();
    expect(neighbours(items, 'missing')).toEqual({ previous: null, next: null });
  });
});

describe('completedModules', () => {
  const inModule = (item: OutlineItem, moduleSlug: string): OutlineItem => ({
    ...item,
    moduleSlug,
  });
  const outline = [
    inModule(lesson('a1'), 'a'),
    inModule(exercise('a2'), 'a'),
    inModule(lesson('b1'), 'b'),
  ];

  it('counts a module only when every lesson and exercise in it is done', () => {
    expect(completedModules(outline, statuses({ a1: 'completed' }))).toBe(0);
    expect(completedModules(outline, statuses({ a1: 'completed' }, { a2: 'completed' }))).toBe(1);
    expect(
      completedModules(
        outline,
        statuses({ a1: 'completed', b1: 'completed' }, { a2: 'completed' }),
      ),
    ).toBe(2);
  });

  it('does not count an exercise waiting for review', () => {
    expect(completedModules(outline, statuses({ a1: 'completed' }, { a2: 'in_review' }))).toBe(0);
  });

  it('is zero for an empty outline', () => {
    expect(completedModules([], statuses())).toBe(0);
  });
});
