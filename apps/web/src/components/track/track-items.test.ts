import { describe, expect, it } from 'vitest';
import { countByKind, countTones, exerciseTone, lessonTone, listTrackItems } from './track-items';

const modules = [
  {
    lessons: [
      { id: 'l1', title: 'Giới thiệu' },
      { id: 'l2', title: 'SELECT' },
    ],
    exercises: [{ id: 'x1', title: 'Truy vấn đầu tiên' }],
  },
  { lessons: [{ id: 'l3', title: 'JOIN' }], exercises: [{ id: 'x2', title: 'Ghép bảng' }] },
] as never;

describe('lessonTone / exerciseTone', () => {
  it('folds lesson statuses into tones', () => {
    expect(lessonTone('completed')).toBe('done');
    expect(lessonTone('in_progress')).toBe('active');
    expect(lessonTone('not_started')).toBe('todo');
  });

  it('treats every started-but-not-done exercise state as active', () => {
    for (const state of ['attempted', 'testing', 'in_review', 'needs_changes'] as const) {
      expect(exerciseTone(state)).toBe('active');
    }
    expect(exerciseTone('completed')).toBe('done');
    expect(exerciseTone('locked')).toBe('locked');
    expect(exerciseTone('not_started')).toBe('todo');
  });
});

describe('listTrackItems', () => {
  it('lists items module by module, lessons before exercises', () => {
    const items = listTrackItems(modules, { lessons: {}, exercises: {} });
    expect(items.map((i) => i.id)).toEqual(['l1', 'l2', 'x1', 'l3', 'x2']);
    expect(items[0]).toMatchObject({ kind: 'lesson', href: '/lessons/l1', tone: 'todo' });
    expect(items[2]).toMatchObject({ kind: 'exercise', href: '/exercises/x1' });
  });

  it('uses the member progress and keeps the exact status text', () => {
    const items = listTrackItems(modules, {
      lessons: { l1: 'completed', l2: 'in_progress' },
      exercises: { x1: 'in_review', x2: 'locked' },
    });
    expect(items.map((i) => i.tone)).toEqual(['done', 'active', 'active', 'todo', 'locked']);
    expect(items[2]!.statusText).toBe('Chờ mentor review');
  });
});

describe('countTones / countByKind', () => {
  const items = listTrackItems(modules, {
    lessons: { l1: 'completed', l3: 'completed' },
    exercises: { x1: 'needs_changes', x2: 'locked' },
  });

  it('counts each tone, including zero', () => {
    expect(countTones(items)).toEqual({ done: 2, active: 1, todo: 1, locked: 1 });
    expect(countTones([])).toEqual({ done: 0, active: 0, todo: 0, locked: 0 });
  });

  it('splits done / total into lessons and exercises', () => {
    expect(countByKind(items)).toEqual({
      lessons: { done: 2, total: 3 },
      exercises: { done: 0, total: 2 },
    });
  });
});
