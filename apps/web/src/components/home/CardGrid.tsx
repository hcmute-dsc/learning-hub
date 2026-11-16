import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

export interface CardItem {
  icon: string;
  title: string;
  description: string;
  /** optional link shown at the bottom in orange, like the project cards on hcmute-dsc.io.vn */
  link?: { href: string; label: string };
}

/** Section title + white cards with an icon, bold title, short text and an orange link. */
export function CardGrid({
  id,
  title,
  intro,
  items,
}: {
  id: string;
  title: string;
  intro?: ReactNode;
  items: CardItem[];
}) {
  return (
    <section aria-labelledby={id} className="mt-14">
      <h2 id={id} className="text-center text-2xl font-bold">
        {title}
      </h2>
      {intro && <p className="muted mx-auto mt-2 max-w-2xl text-center">{intro}</p>}
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => (
          <li
            key={item.title}
            className={`surface motion-fade-up flex flex-col rounded-xl p-5 shadow-sm ${item.link ? 'lift' : ''}`}
            style={{ '--i': index } as CSSProperties}
          >
            <span aria-hidden className="text-2xl">
              {item.icon}
            </span>
            <h3 className="mt-2 font-semibold">{item.title}</h3>
            <p className="muted mt-1 flex-1 text-sm">{item.description}</p>
            {item.link && <CardLink {...item.link} />}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CardLink({ href, label }: { href: string; label: string }) {
  const className = 'mt-3 text-sm font-medium text-brand-600 hover:underline';
  // Internal pages use client-side navigation; other club sites are normal links.
  return href.startsWith('/') ? (
    <Link href={href} className={className}>
      {label} →
    </Link>
  ) : (
    <a href={href} className={className}>
      {label} →
    </a>
  );
}
