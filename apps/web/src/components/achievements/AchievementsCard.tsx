import Link from 'next/link';
import type { Achievements } from '@hub/shared';
import { BadgeGrid } from './BadgeGrid';
import { badgeCards, streakMessage } from './achievements';

/**
 * Dashboard card with the streak and every badge, earned or not (PRD F12). Not shown at
 * all when the member turned achievements off; the link to /settings says where.
 */
export function AchievementsCard({ achievements }: { achievements: Achievements }) {
  const { streak } = achievements;
  return (
    <section aria-labelledby="achievements-heading" className="surface rounded-2xl p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="achievements-heading" className="text-xl font-bold">
          Thành tích
        </h2>
        <Link href="/settings" className="muted text-xs hover:underline">
          Ẩn trong cài đặt
        </Link>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span aria-hidden className="text-3xl">
          🔥
        </span>
        <div>
          <p className="font-semibold">
            <span className="text-2xl tabular-nums">{streak.current}</span> ngày học liên tiếp
          </p>
          <p className="muted text-xs">{streakMessage(streak)}</p>
        </div>
      </div>
      <h3 className="sr-only">Huy hiệu</h3>
      <div className="mt-4">
        <BadgeGrid cards={badgeCards(achievements.badges, true)} />
      </div>
    </section>
  );
}
