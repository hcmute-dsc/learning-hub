import type { MentorTrackRef } from '@hub/shared';

/** Pure helpers for /admin/mentors (tested in mentor-tracks.test.ts). */

/** Tracks the admin can still give this mentor, in catalog order. */
export function tracksToAdd<T extends { slug: string }>(all: T[], assigned: MentorTrackRef[]): T[] {
  const taken = new Set(assigned.map((t) => t.slug));
  return all.filter((t) => !taken.has(t.slug));
}

/** "3 mentee", "Chưa kèm mentee" */
export function menteeCountLabel(count: number): string {
  return count > 0 ? `${count} mentee` : 'Chưa kèm mentee';
}
