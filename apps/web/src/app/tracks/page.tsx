import type { Metadata } from 'next';
import Link from 'next/link';
import { TRACK_LEVELS, type Paginated, type TrackSummary } from '@hub/shared';
import { api } from '@/lib/api';
import { LEVEL_LABEL } from '@/lib/labels';

export const metadata: Metadata = { title: 'Lộ trình' };

export default async function TracksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; level?: string }>;
}) {
  const { q, level } = await searchParams;
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (level && (TRACK_LEVELS as readonly string[]).includes(level)) params.set('level', level);
  const { data: tracks, page } = await api<Paginated<TrackSummary>>(`/tracks?${params}`);

  return (
    <section>
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Lộ trình học của CLB</h1>
        <p className="muted mx-auto mt-3 max-w-xl">
          Mỗi lộ trình gồm bài học ngắn và bài tập thực hành, do chính thành viên CLB viết và
          review.
        </p>
      </header>

      {/* Search + filter in the URL, so results are shareable and work without JS. */}
      <form
        role="search"
        className="surface mt-8 flex flex-col gap-3 rounded-xl p-3 sm:flex-row sm:items-center"
      >
        <label className="sr-only" htmlFor="q">
          Tìm lộ trình
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Tìm lộ trình…"
          className="flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2"
        />
        <label className="sr-only" htmlFor="level">
          Trình độ
        </label>
        <select
          id="level"
          name="level"
          defaultValue={level ?? ''}
          className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2"
        >
          <option value="">Mọi trình độ</option>
          {TRACK_LEVELS.map((l) => (
            <option key={l} value={l}>
              {LEVEL_LABEL[l]}
            </option>
          ))}
        </select>
        <button className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700">
          Lọc
        </button>
        <p className="muted text-sm sm:ml-2" aria-live="polite">
          {page.total} lộ trình
        </p>
      </form>

      {tracks.length === 0 ? (
        <p className="muted mt-10 text-center">
          Không có lộ trình nào khớp. Thử bỏ bộ lọc, hoặc{' '}
          <a className="underline" href="https://github.com/hcmute-dsc">
            đóng góp một lộ trình mới
          </a>
          .
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {tracks.map((t) => (
            <li key={t.id}>
              <Link
                href={`/tracks/${t.slug}`}
                className="surface flex gap-4 rounded-xl p-5 transition hover:border-brand-500"
              >
                <span
                  aria-hidden
                  className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-brand-50 font-mono text-lg font-bold text-brand-700"
                >
                  {t.title.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block text-lg font-semibold">{t.title}</span>
                  <span className="muted mt-0.5 block text-sm">
                    {t.lessonCount} bài học · {t.exerciseCount} bài tập
                    {t.estHours ? ` · ~${t.estHours} giờ` : ''}
                  </span>
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                      {LEVEL_LABEL[t.level]}
                    </span>
                    {t.tags.map((tag) => (
                      <span
                        key={tag}
                        className="muted rounded-full border border-[var(--border)] px-2 py-0.5 text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
