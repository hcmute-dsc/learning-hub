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

/**
 * Which module starts open on the track page (learning-hub#61): the one the member is on,
 * i.e. the first module that is not finished. Before enrolling, the first module. When
 * every module is finished, none: the page is then a summary and the member opens what
 * they want to revisit.
 */
export function openModuleIndex(
  modules: Pick<ModuleOutlineData, 'lessons' | 'exercises'>[],
  progress: Pick<TrackItemsProgress, 'lessons' | 'exercises'>,
  enrolled: boolean,
): number | null {
  if (modules.length === 0) return null;
  if (!enrolled) return 0;
  const index = modules.findIndex((m) => {
    const c = countDone([m], progress);
    return c.total > 0 && c.done < c.total;
  });
  return index === -1 ? null : index;
}
