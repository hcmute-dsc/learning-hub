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
