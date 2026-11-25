'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { AdminMentorRow } from '@hub/shared';
import { ProblemAlert } from '@/components/exercise/ProblemAlert';
import { sendJson } from '@/lib/client-api';
import { formatLongDate } from '@/lib/format';
import { useMutation } from '@/lib/use-mutation';
import { tracksToAdd } from './mentor-tracks';

/**
 * Tracks one mentor looks after, editable in place by an admin (learning-hub#120):
 * POST /admin/mentors/:id/tracks and DELETE /admin/mentors/:id/tracks/:slug. Removing is
 * not asked twice: the row stays as history and adding it back is one click.
 */
export function MentorTracksCell({
  row,
  tracks,
}: {
  row: AdminMentorRow;
  tracks: { slug: string; title: string }[];
}) {
  const options = tracksToAdd(tracks, row.tracks);
  const [picked, setPicked] = useState('');
  const { run, busy, problem } = useMutation();
  const base = `/admin/mentors/${encodeURIComponent(row.mentor.id)}/tracks`;
  const who = `@${row.mentor.githubLogin}`;

  async function add() {
    if (!picked) return;
    const result = await run(() => sendJson(base, 'POST', { trackSlug: picked }));
    if (result.ok) setPicked('');
  }

  return (
    <div className="space-y-2">
      {row.tracks.length === 0 ? (
        <p className="muted text-sm">Chưa phụ trách track nào.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5" aria-label={`Track ${who} phụ trách`}>
          {row.tracks.map((t) => (
            <li
              key={t.slug}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] py-0.5 pl-2.5 pr-1 text-sm"
              title={`Từ ${formatLongDate(t.since)}`}
            >
              <Link href={`/tracks/${encodeURIComponent(t.slug)}`} className="hover:underline">
                {t.title}
              </Link>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(() => sendJson(`${base}/${encodeURIComponent(t.slug)}`, 'DELETE'))
                }
                aria-label={`Bỏ ${who} khỏi track ${t.title}`}
                className="press grid size-6 place-items-center rounded-full hover:bg-brand-50 dark:hover:bg-white/10 disabled:opacity-50"
              >
                <span aria-hidden>×</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {options.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <label className="sr-only" htmlFor={`add-track-${row.mentor.id}`}>
            Thêm track cho {who}
          </label>
          <select
            id={`add-track-${row.mentor.id}`}
            value={picked}
            disabled={busy}
            onChange={(e) => setPicked(e.target.value)}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm"
          >
            <option value="">Chọn track…</option>
            {options.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={add}
            disabled={busy || !picked}
            aria-busy={busy}
            className="press rounded-md bg-brand-600 px-2.5 py-1 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Thêm
          </button>
        </div>
      )}
      <ProblemAlert problem={problem} />
    </div>
  );
}
