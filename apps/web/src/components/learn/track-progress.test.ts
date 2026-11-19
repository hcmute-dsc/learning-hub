import { describe, expect, it } from 'vitest';
import { countDone, openModuleIndex } from './track-progress';

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

describe('openModuleIndex', () => {
  const none = { lessons: {}, exercises: {} };

  it('opens the first module before enrolling', () => {
    expect(openModuleIndex(modules, none, false)).toBe(0);
  });

  it('opens the first module that is not finished', () => {
    expect(openModuleIndex(modules, none, true)).toBe(0);
    const firstDone = {
      lessons: { l1: 'completed', l2: 'completed' },
      exercises: { x1: 'completed' },
    } as const;
    expect(openModuleIndex(modules, firstDone, true)).toBe(1);
  });

  it('skips empty modules and opens none when everything is finished', () => {
    const withEmpty = [{ lessons: [], exercises: [] }, ...(modules as never[])] as never;
    expect(openModuleIndex(withEmpty, none, true)).toBe(1);
    const allDone = {
      lessons: { l1: 'completed', l2: 'completed', l3: 'completed' },
      exercises: { x1: 'completed' },
    } as const;
    expect(openModuleIndex(modules, allDone, true)).toBeNull();
    expect(openModuleIndex([], none, false)).toBeNull();
  });
});
