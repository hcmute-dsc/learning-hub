import type { MentorChoice, MentorTrackRef } from '@hub/shared';

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

/** "Mai Hồng Tín · 3/5 mentee" for the mentor picker of a mentee. */
export function mentorOptionLabel(choice: MentorChoice, maxMentees: number): string {
  return `${choice.mentor.displayName} · ${choice.activeMentees}/${maxMentees} mentee`;
}

/** A full mentor cannot take a new mentee, but stays selectable for their own mentees. */
export function isMentorFull(
  choice: MentorChoice,
  maxMentees: number,
  currentMentorId: string | null,
): boolean {
  return choice.mentor.id !== currentMentorId && choice.activeMentees >= maxMentees;
}
