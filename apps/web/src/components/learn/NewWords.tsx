import Link from 'next/link';
import type { GlossaryTerm } from '@hub/shared';
import { glossaryHref } from '@/components/track/glossary';

/**
 * "Từ mới trong bài" at the top of a lesson (learning-hub#106): the words the lesson
 * introduces (`terms:`), each with its full form and literal Vietnamese meaning, as
 * TEACHING.md T1 asks. Each word links to the track's "Từ vựng" page.
 */
export function NewWords({ trackSlug, terms }: { trackSlug: string; terms: GlossaryTerm[] }) {
  if (terms.length === 0) return null;
  return (
    <section aria-labelledby="new-words" className="surface rounded-xl p-4 sm:p-5">
      <h2 id="new-words" className="font-semibold">
        <span aria-hidden>🔤 </span>Từ mới trong bài
      </h2>
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
    </section>
  );
}
