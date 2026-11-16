import { describe, expect, it } from 'vitest';
import { countDone } from './track-progress';

const modules = [
  { lessons: [{ id: 'l1' }, { id: 'l2' }], exercises: [{ id: 'x1' }] },
  { lessons: [{ id: 'l3' }], exercises: [] },
] as never;

describe('countDone', () => {
  it('counts completed lessons and exercises over every module', () => {
    const r = countDone(modules, {
      lessons: { l1: 'completed', l2: 'in_progress', l3: 'completed' },
      exercises: { x1: 'completed' },
    });
    expect(r).toEqual({ done: 3, total: 4, percent: 75 });
  });

  it('treats missing statuses as not done and an empty list as 0%', () => {
    expect(countDone(modules, { lessons: {}, exercises: {} }).done).toBe(0);
    expect(countDone([], { lessons: {}, exercises: {} })).toEqual({
      done: 0,
      total: 0,
      percent: 0,
    });
  });
});
