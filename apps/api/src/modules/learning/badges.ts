import { BADGES, type BadgeCode } from '@hub/shared';

/**
 * Badge rules (PRD F12). Pure: the service loads the member's learning facts, these
 * decide which badges they deserve. The titles and icons are in packages/shared
 * achievements.ts. A badge, once stored, is never taken back, even if content changes
 * later (like a completed track, progress.ts enrollmentStatus).
 */
export interface LearningFacts {
  lessonsCompleted: number;
  exercisesCompleted: number;
  /** modules (chặng) where every lesson and exercise is done */
  modulesCompleted: number;
  tracksCompleted: number;
  /** longest streak ever, in active days (activity.ts streaks) */
  longestStreak: number;
}

const RULES: Record<BadgeCode, (facts: LearningFacts) => boolean> = {
  first_lesson: (f) => f.lessonsCompleted >= 1,
  first_exercise: (f) => f.exercisesCompleted >= 1,
  first_module: (f) => f.modulesCompleted >= 1,
  first_track: (f) => f.tracksCompleted >= 1,
  exercises_10: (f) => f.exercisesCompleted >= 10,
  streak_7: (f) => f.longestStreak >= 7,
};

/** Every badge the facts deserve, in the order of BADGES. */
export function earnedBadges(facts: LearningFacts): BadgeCode[] {
  const earned: BadgeCode[] = [];
  for (const badge of BADGES) {
    if (RULES[badge.code](facts)) earned.push(badge.code);
  }
  return earned;
}

/** Badges the member deserves but does not have yet: the ones to award now. */
export function badgesToAward(facts: LearningFacts, stored: Iterable<string>): BadgeCode[] {
  const have = new Set(stored);
  return earnedBadges(facts).filter((code) => !have.has(code));
}
