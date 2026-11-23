'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { TrackGlossaryView } from '@hub/shared';
import { lessonHref } from '@/components/learn/links';
import { glossaryGroups, letterId, matchesGlossaryQuery } from './glossary';

type Term = TrackGlossaryView['terms'][number];

/**
 * The terms of the "Từ vựng" page (learning-hub#106): a search box, A–Z letters, and each
 * term with its anchor (`#init`), full form, literal meaning, meaning, example, related
 * terms and the lessons that teach it. Rendered on the server first, so `#anchor` links
 * work before the script loads; the search box filters in the browser.
 */
export function GlossaryList({ terms }: { terms: Term[] }) {
  const [query, setQuery] = useState('');
  const groups = useMemo(
    () => glossaryGroups(terms.filter((t) => matchesGlossaryQuery(t, query))),
    [terms, query],
  );
  const shown = groups.reduce((n, g) => n + g.terms.length, 0);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <label className="block max-w-md">
          <span className="text-sm font-medium">Tìm từ</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="init, khởi tạo…"
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
          />
        </label>
        <p className="muted text-sm" aria-live="polite">
          {query.trim() ? `${shown} / ${terms.length} từ` : `${terms.length} từ`}
        </p>
        {groups.length > 1 && (
          <nav aria-label="Chữ cái">
            <ul className="flex flex-wrap gap-1">
              {groups.map((g) => (
                <li key={g.letter}>
                  <a
                    href={`#${letterId(g.letter)}`}
                    className="surface inline-block min-w-9 rounded-md px-2 py-1 text-center text-sm font-medium hover:underline"
                  >
                    {g.letter}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>

      {groups.length === 0 && <p className="muted">Không có từ nào khớp với “{query}”.</p>}

      {groups.map((g) => (
        <section key={g.letter} aria-labelledby={letterId(g.letter)}>
          <h2
            id={letterId(g.letter)}
            className="glossary-entry border-b border-[var(--border)] pb-1 text-xl font-bold"
          >
            {g.letter}
          </h2>
          <ul className="mt-3 space-y-4">
            {g.terms.map((t) => (
              <GlossaryEntry key={t.anchor} term={t} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function GlossaryEntry({ term: t }: { term: Term }) {
  return (
    <li id={t.anchor} className="glossary-entry space-y-1">
      <p>
        <dfn lang="en" className="text-lg font-semibold not-italic">
          {t.term}
        </dfn>
        {t.expansion && (
          <>
            {' '}
            = <em lang="en">{t.expansion}</em>
          </>
        )}
        {t.literal && <span className="muted"> · nghĩa đen: {t.literal}</span>}
      </p>
      <p>{t.meaning}</p>
      {t.example && (
        <p className="text-sm">
          <span className="muted">Ví dụ: </span>
          <code className="inline-code break-all">{t.example}</code>
        </p>
      )}
      {t.see.length > 0 && (
        <p className="text-sm">
          <span className="muted">Xem thêm: </span>
          {t.see.map((s, i) => (
            <span key={s.anchor}>
              {i > 0 && ', '}
              <a href={`#${s.anchor}`} lang="en" className="text-brand-600 hover:underline">
                {s.term}
              </a>
            </span>
          ))}
        </p>
      )}
      {t.lessons.length > 0 && (
        <p className="text-sm">
          <span className="muted">Học ở bài: </span>
          {t.lessons.map((l, i) => (
            <span key={l.id}>
              {i > 0 && ', '}
              <Link
                prefetch={false}
                href={lessonHref(l.id)}
                className="text-brand-600 hover:underline"
              >
                {l.title}
              </Link>
            </span>
          ))}
        </p>
      )}
    </li>
  );
}
