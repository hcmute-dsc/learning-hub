import { BADGES, type EarnedBadge, type Streak } from '@hub/shared';

/** One badge as drawn: earned ones have a date, locked ones (dashboard only) do not. */
export interface BadgeCard {
  code: string;
  icon: string;
  title: string;
  description: string;
  /** ISO date-time, null when not earned yet */
  awardedAt: string | null;
}

/** The two colours of a badge's medal gradient, light top to deep bottom. */
export interface BadgeTone {
  from: string;
  to: string;
}

/**
 * One colour per badge, so the medals are easy to tell apart at a glance. The colour is
 * decoration only: every badge also has its title and date in text. A new badge without
 * an entry here gets the club orange; add it here to give it its own colour.
 */
export const BADGE_TONES: Record<string, BadgeTone> = {
  first_lesson: { from: '#7dd3fc', to: '#2563eb' }, // sky → blue
  first_exercise: { from: '#fde68a', to: '#d97706' }, // gold
  first_module: { from: '#6ee7b7', to: '#059669' }, // emerald
  first_track: { from: '#c4b5fd', to: '#7c3aed' }, // violet
  exercises_10: { from: '#fda4af', to: '#e11d48' }, // rose
  streak_7: { from: '#fdba74', to: '#dc2626' }, // fire
};

const DEFAULT_TONE: BadgeTone = { from: '#f9a27f', to: '#f0622d' };

export function badgeTone(code: string): BadgeTone {
  return BADGE_TONES[code] ?? DEFAULT_TONE;
}

/**
 * Badges to draw, in the order of BADGES. With `includeLocked` (the member's own
 * dashboard) badges not earned yet are listed too, so the member sees what comes next;
 * a profile shows earned badges only.
 */
export function badgeCards(earned: EarnedBadge[], includeLocked: boolean): BadgeCard[] {
  const awardedAt = new Map(earned.map((b) => [b.code as string, b.awardedAt]));
  const cards: BadgeCard[] = [];
  for (const badge of BADGES) {
    const at = awardedAt.get(badge.code) ?? null;
    if (at === null && !includeLocked) continue;
    cards.push({
      code: badge.code,
      icon: badge.icon,
      title: badge.title,
      description: badge.description,
      awardedAt: at,
    });
  }
  return cards;
}

/**
 * One friendly line about the streak. Never scolds: a streak of 0 is an invitation,
 * and the forgiven day is explained (PRD F12).
 */
export function streakMessage(streak: Streak): string {
  if (streak.current === 0) {
    return streak.longest > 0
      ? `Chuỗi dài nhất của bạn là ${streak.longest} ngày. Học một bài hôm nay để bắt đầu chuỗi mới.`
      : 'Học một bài hôm nay để bắt đầu chuỗi ngày học.';
  }
  return 'Được nghỉ xen kẽ 1 ngày mà chuỗi vẫn giữ.';
}
