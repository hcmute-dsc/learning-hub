import { formatMonth } from '@/components/profile/profile';
import { BadgeMedal, badgeStyle } from './BadgeMedal';
import type { BadgeCard } from './achievements';

/**
 * Badges as one row each, for the narrow dashboard column (learning-hub#56): a grid of
 * tiles there squeezed the text into many short lines. Same medal and tint as the
 * profile's BadgeGrid (learning-hub#74). Earned rows say when; locked rows are greyed
 * out and say how to earn them.
 */
export function BadgeList({ cards }: { cards: BadgeCard[] }) {
  return (
    <ul className="space-y-2">
      {cards.map((card) => {
        const earned = card.awardedAt !== null;
        return (
          <li
            key={card.code}
            data-locked={earned ? undefined : ''}
            data-layout="row"
            className="badge-tile flex items-center gap-3 rounded-xl px-3 py-2"
            style={badgeStyle(card.code)}
          >
            <BadgeMedal card={card} size="sm" />
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
