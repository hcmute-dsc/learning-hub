import type { ExerciseState, LessonStatus, TrackItemsProgress } from '@hub/shared';
import { EXERCISE_STATE_LABEL, LESSON_PROGRESS_LABEL } from '@/lib/labels';
import type { ModuleOutlineData } from '@/components/learn/ModuleOutline';
import { exerciseHref, lessonHref } from '@/components/learn/links';

/**
 * Pure helpers for the track overview page (no React, so they are easy to test).
 * The page shows lessons and exercises together, so their many states are folded into
 * four "tones" that a member can tell apart at a glance in the dot grid.
 */

/** done = completed, active = started but not done, todo = not started, locked = prerequisites missing */
export type ItemTone = 'done' | 'active' | 'todo' | 'locked';

/** Order used by the legend. */
export const ITEM_TONES: ItemTone[] = ['done', 'active', 'todo', 'locked'];

export interface TrackItem {
  kind: 'lesson' | 'exercise';
  id: string;
  title: string;
  href: string;
  tone: ItemTone;
  /** Exact Vietnamese status, e.g. "Chờ mentor review" (more precise than the tone). */
  statusText: string;
}

export function lessonTone(status: LessonStatus): ItemTone {
  if (status === 'completed') return 'done';
  if (status === 'in_progress') return 'active';
  return 'todo';
}

export function exerciseTone(state: ExerciseState): ItemTone {
  if (state === 'completed') return 'done';
  if (state === 'locked') return 'locked';
  if (state === 'not_started') return 'todo';
  // attempted, testing, in_review, needs_changes: the member has started working on it.
  return 'active';
}

/**
 * Every lesson and exercise of the track in reading order: module by module, lessons
 * first, then exercises (the same order as the API's `next` rule).
 * A missing status means "not started" (e.g. the member has not enrolled yet).
 */
export function listTrackItems(
  modules: Pick<ModuleOutlineData, 'lessons' | 'exercises'>[],
  progress: Pick<TrackItemsProgress, 'lessons' | 'exercises'>,
): TrackItem[] {
  const items: TrackItem[] = [];
  for (const m of modules) {
    for (const l of m.lessons) {
      const status = progress.lessons[l.id] ?? 'not_started';
      items.push({
        kind: 'lesson',
        id: l.id,
        title: l.title,
        href: lessonHref(l.id),
        tone: lessonTone(status),
        statusText: LESSON_PROGRESS_LABEL[status].text,
      });
    }
    for (const x of m.exercises) {
      const state = progress.exercises[x.id] ?? 'not_started';
      items.push({
        kind: 'exercise',
        id: x.id,
        title: x.title,
        href: exerciseHref(x.id),
        tone: exerciseTone(state),
        statusText: EXERCISE_STATE_LABEL[state].text,
      });
    }
  }
  return items;
}

/** How many items have each tone (for the legend under the dot grid). */
export function countTones(items: Pick<TrackItem, 'tone'>[]): Record<ItemTone, number> {
  const counts: Record<ItemTone, number> = { done: 0, active: 0, todo: 0, locked: 0 };
  for (const item of items) counts[item.tone] += 1;
  return counts;
}

/** Done / total, split into lessons and exercises (for the stat cards). */
export function countByKind(items: Pick<TrackItem, 'kind' | 'tone'>[]): {
  lessons: { done: number; total: number };
  exercises: { done: number; total: number };
} {
  const lessons = { done: 0, total: 0 };
  const exercises = { done: 0, total: 0 };
  for (const item of items) {
    const count = item.kind === 'lesson' ? lessons : exercises;
    count.total += 1;
    if (item.tone === 'done') count.done += 1;
  }
  return { lessons, exercises };
}
