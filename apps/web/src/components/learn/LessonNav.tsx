import Link from 'next/link';
import type { NextItem } from '@hub/shared';
import { itemHref } from './links';

/** Previous / next item in the track's reading order (INFORMATION-ARCHITECTURE §5). */
export function LessonNav({
  previous,
  next,
}: {
  previous: NextItem | null;
  next: NextItem | null;
}) {
  if (!previous && !next) return null;
  return (
    <nav aria-label="Bài trước và bài sau" className="grid gap-3 sm:grid-cols-2">
      {previous ? (
        <Link href={itemHref(previous)} className="surface rounded-xl p-4 hover:border-brand-500">
          <span className="muted block text-xs">← Trước</span>
          <span className="font-medium">{previous.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link
          href={itemHref(next)}
          className="surface rounded-xl p-4 text-right hover:border-brand-500"
        >
          <span className="muted block text-xs">Sau →</span>
          <span className="font-medium">{next.title}</span>
        </Link>
      )}
    </nav>
  );
}
