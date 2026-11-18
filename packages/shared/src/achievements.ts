/**
 * Badges and the learning streak (PRD F12, added 18/11/2026). Light on purpose: no
 * points, no ranking (PRD §3 "Không gamification nặng"). A member can hide all of it
 * in /settings; badges are still awarded while hidden, so turning them back on shows
 * everything earned so far.
 *
 * The badge list lives here so the API (which awards) and the web (which draws) agree.
 * The rules that award them are in apps/api/src/modules/learning/badges.ts.
 * Adding a badge: add it here, add its rule there, add a test. Never rename a code:
 * it is stored in user_badges.badge.
 */
export const BADGES = [
  {
    code: 'first_lesson',
    icon: '📖',
    title: 'Bài học đầu tiên',
    description: 'Hoàn thành bài học đầu tiên.',
  },
  {
    code: 'first_exercise',
    icon: '🛠️',
    title: 'Bài tập đầu tiên',
    description: 'Hoàn thành bài tập đầu tiên.',
  },
  {
    code: 'first_module',
    icon: '🧩',
    title: 'Xong một chặng',
    description: 'Hoàn thành mọi bài học và bài tập của một chặng trong lộ trình.',
  },
  {
    code: 'first_track',
    icon: '🏁',
    title: 'Về đích',
    description: 'Hoàn thành trọn một lộ trình.',
  },
  {
    code: 'exercises_10',
    icon: '💪',
    title: 'Mười bài tập',
    description: 'Hoàn thành 10 bài tập.',
  },
  {
    code: 'streak_7',
    icon: '🔥',
    title: 'Bền bỉ 7 ngày',
    description: 'Có chuỗi 7 ngày học (được nghỉ xen kẽ 1 ngày).',
  },
] as const;

export type BadgeCode = (typeof BADGES)[number]['code'];
export type BadgeDefinition = (typeof BADGES)[number];

export function badgeDefinition(code: string): BadgeDefinition | undefined {
  return BADGES.find((badge) => badge.code === code);
}

/**
 * Streak in Vietnam days. A single missed day is forgiven; two missed days in a row end
 * the streak. The numbers count days with learning, not calendar days.
 */
export interface Streak {
  /** active days in the run that is still alive (0 when it ended) */
  current: number;
  /** active days in the longest run ever */
  longest: number;
}

export interface EarnedBadge {
  code: BadgeCode;
  /** ISO date-time the badge was awarded */
  awardedAt: string;
}

/**
 * GET /api/v1/me/achievements → { data: Achievements | null }, also
 * MemberProfile.achievements. null means the member turned badges and streak off.
 */
export interface Achievements {
  streak: Streak;
  /** oldest first */
  badges: EarnedBadge[];
}
