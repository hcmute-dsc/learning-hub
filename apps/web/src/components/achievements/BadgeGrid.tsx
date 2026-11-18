import { formatMonth } from '@/components/profile/profile';
import type { BadgeCard } from './achievements';

/** Badges as small tiles. Locked badges are greyed out and say how to earn them. */
export function BadgeGrid({ cards }: { cards: BadgeCard[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {cards.map((card) => {
        const earned = card.awardedAt !== null;
        return (
          <li
            key={card.code}
            title={card.description}
            className={`rounded-xl border p-3 ${
              earned ? 'border-brand-500 bg-brand-50' : 'border-dashed border-[var(--border)]'
            }`}
          >
            <span aria-hidden className={`text-2xl ${earned ? '' : 'opacity-40 grayscale'}`}>
              {card.icon}
            </span>
            <p className={`mt-1 text-sm font-semibold ${earned ? '' : 'muted'}`}>{card.title}</p>
            <p className="muted text-xs">
              {card.awardedAt ? `Đạt ${formatMonth(card.awardedAt)}` : card.description}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
