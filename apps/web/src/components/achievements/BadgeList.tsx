import { formatMonth } from '@/components/profile/profile';
import type { BadgeCard } from './achievements';

/**
 * Badges as one row each, for the narrow dashboard column (learning-hub#56): a grid of
 * tiles there squeezed the text into many short lines. Earned rows say when; locked
 * rows are greyed out and say how to earn them. The wide profile page uses BadgeGrid.
 */
export function BadgeList({ cards }: { cards: BadgeCard[] }) {
  return (
    <ul className="space-y-2">
      {cards.map((card) => {
        const earned = card.awardedAt !== null;
        return (
          <li
            key={card.code}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
              earned ? 'border-brand-500 bg-brand-50' : 'border-dashed border-[var(--border)]'
            }`}
          >
            <span
              aria-hidden
              className={`w-8 shrink-0 text-center text-xl ${earned ? '' : 'opacity-40 grayscale'}`}
            >
              {card.icon}
            </span>
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${earned ? '' : 'muted'}`}>
                {card.title}
                {!earned && <span className="sr-only"> (chưa đạt)</span>}
              </p>
              <p className="muted text-xs">
                {card.awardedAt ? `Đạt ${formatMonth(card.awardedAt)}` : card.description}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
