import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { TrackProgress } from '@hub/shared';
import { EnrollmentCard } from '@/components/learn/EnrollmentCard';

/** Right column of the dashboard: every enrolled track with its progress. */
export function MyTracks({ enrollments }: { enrollments: TrackProgress[] }) {
  return (
    <section aria-labelledby="my-tracks">
      <h2 id="my-tracks" className="text-xl font-bold">
        Lộ trình của bạn ({enrollments.length})
      </h2>
      {enrollments.length === 0 ? (
        <EmptyTracks />
      ) : (
        <ul className="surface mt-4 divide-y divide-[var(--border)] overflow-hidden rounded-2xl">
          {enrollments.map((track, index) => (
            <li
              key={track.trackId}
              className="motion-fade-up"
              style={{ '--i': index + 2 } as CSSProperties}
            >
              <EnrollmentCard track={track} />
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/tracks"
        className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline"
      >
        Xem tất cả lộ trình →
      </Link>
    </section>
  );
}

// FRONTEND-DESIGN §8: an empty state always says what to do next.
function EmptyTracks() {
  return (
    <div className="surface motion-fade-up mt-4 rounded-2xl p-6 text-center">
      <span aria-hidden className="motion-pop inline-block text-5xl">
        🧭
      </span>
      <p className="mt-3 font-semibold">Bạn chưa tham gia lộ trình nào</p>
      <p className="muted mt-1 text-sm">
        Chọn một lộ trình để có bài học, bài tập và tiến độ của riêng bạn.
      </p>
      <Link
        href="/tracks"
        className="press mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700"
      >
        Khám phá lộ trình
      </Link>
    </div>
  );
}
