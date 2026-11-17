import type { ContentTree } from '@hub/content';
import type { ChangePlan } from './plan';

/**
 * What a publish changed, by track, in words people understand (titles, not counts).
 * Sent with ContentEvents.Published so the Discord message can say what is new
 * (first real message only said "new content, commit 01aaa53": 18/11/2026).
 */
export interface TrackChanges {
  slug: string;
  title: string;
  /** the whole track is new */
  isNew: boolean;
  /** titles of new lessons and exercises, in course order */
  added: string[];
  /** titles of lessons and exercises whose content changed, in course order */
  changed: string[];
}

export interface PublishedChanges {
  tracks: TrackChanges[];
  /** lessons + exercises taken off the site (their titles are no longer in the tree) */
  removed: number;
}

export function publishedChanges(tree: ContentTree, plan: ChangePlan): PublishedChanges {
  const added = new Set([...plan.added.lesson, ...plan.added.exercise]);
  const changed = new Set([...plan.changed.lesson, ...plan.changed.exercise]);
  const newTracks = new Set(plan.added.track);
  const changedTracks = new Set(plan.changed.track);

  const tracks: TrackChanges[] = [];
  for (const t of tree.tracks) {
    const entry: TrackChanges = {
      slug: t.slug,
      title: t.title,
      isNew: newTracks.has(t.uid),
      added: [],
      changed: [],
    };
    for (const m of t.modules) {
      for (const item of [...m.lessons, ...m.exercises].sort((a, b) => a.position - b.position)) {
        if (added.has(item.uid)) entry.added.push(item.title);
        else if (changed.has(item.uid)) entry.changed.push(item.title);
      }
    }
    if (entry.isNew || changedTracks.has(t.uid) || entry.added.length || entry.changed.length) {
      tracks.push(entry);
    }
  }
  return { tracks, removed: plan.diff.lesson.removed + plan.diff.exercise.removed };
}
