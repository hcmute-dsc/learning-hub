import Link from 'next/link';

export interface Crumb {
  label: string;
  /** Omit for the current page */
  href?: string;
}

/** "Lộ trình › Track › Module" trail (INFORMATION-ARCHITECTURE §5). */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="muted text-sm">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => (
          <li key={`${i}-${item.label}`} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden>›</span>}
            {item.href ? (
              <Link href={item.href} className="hover:underline">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
