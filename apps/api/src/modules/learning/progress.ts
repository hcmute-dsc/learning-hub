import type { ExerciseState, LessonStatus, NextItem, ProgressCount } from '@hub/shared';
import type { OutlineItem } from '../catalog/catalog.reader';

/**
 * Progress rules for one member in one track (BACKEND-DESIGN §2 learning).
 * Pure functions: the services load data, these decide. Exercise progress is never
 * stored, it comes from submissions (DATABASE §3.11), so the caller passes states in.
 */

export interface ItemStatuses {
  /** lessonId → status; a missing lesson counts as not_started */
  lessons: Map<string, LessonStatus>;
  /** exerciseId → state; a missing exercise counts as not_started */
  exercises: Map<string, ExerciseState>;
}

export interface ProgressSummary {
  lessons: ProgressCount;
  exercises: ProgressCount;
  percent: number;
  next: NextItem | null;
}

export function isItemDone(item: OutlineItem, statuses: ItemStatuses): boolean {
  if (item.kind === 'lesson') return statuses.lessons.get(item.id) === 'completed';
  return statuses.exercises.get(item.id) === 'completed';
}

/**
 * True when the track has at least one item and every item is done. Completion is
 * decided from the counts, never from the rounded percent (199/200 rounds to 100%).
 * A track with nothing in it is never done.
 */
export function isAllDone(lessons: ProgressCount, exercises: ProgressCount): boolean {
  const total = lessons.total + exercises.total;
  return total > 0 && lessons.done + exercises.done === total;
}

/** 0–100 for display. Capped at 99 until every item is done, so 100% always means done. */
export function percentOf(lessons: ProgressCount, exercises: ProgressCount): number {
  const total = lessons.total + exercises.total;
  if (total === 0) return 0;
  if (isAllDone(lessons, exercises)) return 100;
  return Math.min(99, Math.round((100 * (lessons.done + exercises.done)) / total));
}

/**
 * The "Tiếp tục học" item (USER-FLOWS §2): the first item in reading order that is not
 * done. Locked exercises are skipped while something else is open. When only locked
 * exercises are left (a prerequisite may sit in another track), the first locked one is
 * returned: its page lists the prerequisites to finish. null means nothing is left.
 */
export function nextItem(items: OutlineItem[], statuses: ItemStatuses): NextItem | null {
  let firstLocked: OutlineItem | null = null;
  for (const item of items) {
    if (isItemDone(item, statuses)) continue;
    if (item.kind === 'exercise' && statuses.exercises.get(item.id) === 'locked') {
      if (!firstLocked) firstLocked = item;
      continue;
    }
    return toRef(item);
  }
  return firstLocked ? toRef(firstLocked) : null;
}

function toRef(item: OutlineItem): NextItem {
  return { kind: item.kind, id: item.id, title: item.title };
}

export function summarize(items: OutlineItem[], statuses: ItemStatuses): ProgressSummary {
  const lessons: ProgressCount = { done: 0, total: 0 };
  const exercises: ProgressCount = { done: 0, total: 0 };
  for (const item of items) {
    const count = item.kind === 'lesson' ? lessons : exercises;
    count.total += 1;
    if (isItemDone(item, statuses)) count.done += 1;
  }
  return {
    lessons,
    exercises,
    percent: percentOf(lessons, exercises),
    next: nextItem(items, statuses),
  };
}

/**
 * Number of modules (chặng) in the outline where every lesson and exercise is done
 * (badge first_module, F12). A module with no items is never counted.
 */
export function completedModules(items: OutlineItem[], statuses: ItemStatuses): number {
  const allDone = new Map<string, boolean>();
  for (const item of items) {
    const doneSoFar = allDone.get(item.moduleSlug) ?? true;
    allDone.set(item.moduleSlug, doneSoFar && isItemDone(item, statuses));
  }
  let count = 0;
  for (const done of allDone.values()) if (done) count++;
  return count;
}

/**
 * Status shown for an enrollment. Completing a track is a milestone: once stored as
 * completed it stays completed even if new lessons are published later.
 */
export function enrollmentStatus(stored: string, allDone: boolean): 'active' | 'completed' {
  return stored === 'completed' || allDone ? 'completed' : 'active';
}

/** True the first time every item is done on an enrollment not stored as completed yet. */
export function shouldMarkCompleted(stored: string, allDone: boolean): boolean {
  return stored === 'active' && allDone;
}

/** Previous and next items around one item, in the track's reading order (LessonView). */
export function neighbours(
  items: OutlineItem[],
  id: string,
): { previous: NextItem | null; next: NextItem | null } {
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return { previous: null, next: null };
  const previous = items[index - 1];
  const next = items[index + 1];
  return { previous: previous ? toRef(previous) : null, next: next ? toRef(next) : null };
}
