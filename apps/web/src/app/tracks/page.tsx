import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import type { Paginated, TrackProgress, TrackSummary } from '@hub/shared';
import { CatalogToolbar } from '@/components/catalog/CatalogToolbar';
import { TrackCard } from '@/components/catalog/TrackCard';
import { parseFilters, progressBySlug, tracksQuery } from '@/components/catalog/catalog';
import { api } from '@/lib/api';
import { CLUB_LINKS } from '@/lib/club';

export const metadata: Metadata = { title: 'Lộ trình' };

/** Track catalog, laid out like Exercism's /tracks: hero, toolbar, grid of cards. */
export default async function TracksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; level?: string }>;
}) {
  const filters = parseFilters(await searchParams);
  const [{ data: tracks, page }, { data: enrollments }] = await Promise.all([
    api<Paginated<TrackSummary>>(`/tracks?${tracksQuery(filters)}`),
    api<{ data: TrackProgress[] }>('/me/enrollments'),
  ]);
  const progress = progressBySlug(enrollments);
  const filtered = Boolean(filters.q || filters.level);

  return (
    <section>
      <header className="motion-fade-up text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {filtered ? (
            'Lộ trình học của CLB'
          ) : (
            <>
              <span className="text-brand-600">{page.total} lộ trình</span> để bạn học bằng cách làm
            </>
          )}
        </h1>
        <p className="muted mx-auto mt-3 max-w-xl">
          Mỗi lộ trình gồm bài học ngắn và bài tập thực hành, do chính thành viên CLB viết và
          review.
        </p>
      </header>

      <div className="mt-8">
        <CatalogToolbar filters={filters} total={page.total} />
      </div>

      {tracks.length === 0 ? (
        // FRONTEND-DESIGN §8: an empty state always says what to do next.
        <div className="motion-fade-up mt-12 text-center">
          <span aria-hidden className="text-5xl">
            🔭
          </span>
          <p className="muted mt-3">
            Không có lộ trình nào khớp. Thử bỏ bộ lọc, hoặc{' '}
            <a className="font-medium text-brand-600 underline" href={CLUB_LINKS.contribute}>
              đóng góp một lộ trình mới
            </a>
            .
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tracks.map((track, index) => (
            <li
              key={track.id}
              className="motion-fade-up"
              style={{ '--i': index + 2 } as CSSProperties}
            >
              <TrackCard track={track} percent={progress.get(track.slug)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
