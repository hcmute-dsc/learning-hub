import Link from 'next/link';
import type { CSSProperties } from 'react';

export interface StartCard {
  emoji: string;
  title: string;
  description: string;
  href: string;
  /** visible call to action at the bottom of the card */
  cta: string;
}

/**
 * "Bắt đầu từ đâu…": big friendly cards, like the first block of Exercism's dashboard.
 * The whole card is one link, so there is nothing interactive nested inside it.
 */
export function StartCards({ cards }: { cards: StartCard[] }) {
  return (
    <section aria-labelledby="start-here">
      <h2 id="start-here" className="text-xl font-bold">
        Bắt đầu từ đâu…
      </h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {cards.map((card, index) => (
          <li
            key={card.title}
            className="motion-fade-up"
            style={{ '--i': index + 1 } as CSSProperties}
          >
            <CardLink card={card} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CardLink({ card }: { card: StartCard }) {
  const className =
    'surface lift press group/card flex h-full flex-col rounded-2xl p-5 shadow-sm sm:p-6';
  const body = (
    <>
      <span
        aria-hidden
        className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-4xl transition-transform duration-300 group-hover/card:scale-110 group-hover/card:-rotate-6"
      >
        {card.emoji}
      </span>
      <span className="mt-4 text-lg font-semibold">{card.title}</span>
      <span className="muted mt-1 flex-1 text-sm">{card.description}</span>
      <span className="mt-4 text-sm font-medium text-brand-600">
        {card.cta}{' '}
        <span
          aria-hidden
          className="inline-block transition-transform group-hover/card:translate-x-1"
        >
          →
        </span>
      </span>
    </>
  );
  // Internal pages use client-side navigation; other club sites are normal links.
  return card.href.startsWith('/') ? (
    <Link href={card.href} className={className}>
      {body}
    </Link>
  ) : (
    <a href={card.href} className={className}>
      {body}
    </a>
  );
}
