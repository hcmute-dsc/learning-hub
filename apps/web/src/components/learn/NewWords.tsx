import Link from 'next/link';
import type { GlossaryTerm } from '@hub/shared';
import { glossaryHref } from '@/components/track/glossary';

/**
 * "Từ mới trong bài" at the end of a lesson (learning-hub#106, #114): the words the lesson
 * introduces (`terms:`), each with its full form and literal Vietnamese meaning, as
 * TEACHING.md T1 asks. Each word links to the track's "Từ vựng" page.
 *
 * Folded by default and below the text: the first use of each word in the text already
 * has a note, so the box is a recap, not something to read before the lesson. A native
 * <details> opens by tap or keyboard and works without JavaScript.
 */
export function NewWords({ trackSlug, terms }: { trackSlug: string; terms: GlossaryTerm[] }) {
  if (terms.length === 0) return null;
  return (
    <details className="surface rounded-xl p-4 sm:p-5">
      <summary className="cursor-pointer font-semibold">
        <span aria-hidden>🔤 </span>Từ mới trong bài ({terms.length})
      </summary>
      <ul className="mt-3 space-y-2 text-sm">
        {terms.map((t) => (
          <li key={t.anchor}>
            <Link
              prefetch={false}
              href={glossaryHref(trackSlug, t.anchor)}
              lang="en"
              className="font-semibold text-brand-600 hover:underline"
            >
              {t.term}
            </Link>
            {t.expansion && (
              <>
                {' '}
                = <em lang="en">{t.expansion}</em>
              </>
            )}
            {t.literal && <span className="muted"> · {t.literal}</span>}
            <span className="block">{t.meaning}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
