import { formatMonth } from '@/components/profile/profile';
import { BadgeMedal, badgeStyle } from './BadgeMedal';
import type { BadgeCard } from './achievements';

/**
 * Badges as a shelf of medal tiles (profile page). Each tile is tinted with its badge's
 * colour and lifts with a shine on hover (no motion when the member asks for less).
 * Locked badges are greyed out, say "chưa đạt" to screen readers and how to earn them.
 */
export function BadgeGrid({ cards }: { cards: BadgeCard[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {cards.map((card) => {
        const earned = card.awardedAt !== null;
        return (
          <li
            key={card.code}
            title={card.description}
            data-locked={earned ? undefined : ''}
            className="badge-tile flex flex-col items-center rounded-2xl px-3 pb-4 pt-5 text-center"
            style={badgeStyle(card.code)}
          >
            <BadgeMedal card={card} />
            <p className={`mt-3 text-sm font-semibold leading-snug ${earned ? '' : 'muted'}`}>
              {card.title}
              {!earned && <span className="sr-only"> (chưa đạt)</span>}
            </p>
            <p className="muted mt-0.5 text-xs">
              {card.awardedAt ? `Đạt ${formatMonth(card.awardedAt)}` : card.description}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
