import type { TrackItemsProgress } from '@hub/shared';
import type { ModuleOutlineData } from './ModuleOutline';

/** Done / total over all lessons and exercises of some modules (whole track or one module). */
export function countDone(
  modules: Pick<ModuleOutlineData, 'lessons' | 'exercises'>[],
  progress: Pick<TrackItemsProgress, 'lessons' | 'exercises'>,
): { done: number; total: number; percent: number } {
  let done = 0;
  let total = 0;
  for (const m of modules) {
    for (const l of m.lessons) {
      total += 1;
      if (progress.lessons[l.id] === 'completed') done += 1;
    }
    for (const x of m.exercises) {
      total += 1;
      if (progress.exercises[x.id] === 'completed') done += 1;
    }
  }
  return { done, total, percent: total === 0 ? 0 : Math.round((100 * done) / total) };
}
