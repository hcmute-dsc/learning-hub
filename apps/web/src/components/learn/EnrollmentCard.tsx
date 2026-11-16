import Link from 'next/link';
import type { TrackProgress } from '@hub/shared';
import { itemHref } from './links';
import { ProgressBar } from './ProgressBar';

/** One enrolled track on the dashboard: progress and the next thing to open (USER-FLOWS §2). */
export function EnrollmentCard({ track }: { track: TrackProgress }) {
  const done = track.lessons.done + track.exercises.done;
  const total = track.lessons.total + track.exercises.total;
  return (
    <article className="surface rounded-xl p-5">
      <h3 className="font-semibold">
        <Link href={`/tracks/${track.slug}`} className="hover:underline">
          {track.title}
        </Link>
      </h3>
      <p className="muted mt-0.5 text-sm">
        {track.status === 'completed' ? '✓ Đã hoàn thành' : 'Đang học'}
        {track.cohort && ` · Đợt ${track.cohort}`}
      </p>
      <div className="mt-3">
        <ProgressBar percent={track.percent} label={`Tiến độ lộ trình ${track.title}`} />
        <p className="muted mt-1 text-xs">
          {done}/{total} mục · {track.lessons.done}/{track.lessons.total} bài học ·{' '}
          {track.exercises.done}/{track.exercises.total} bài tập
        </p>
      </div>
      {track.next && (
        <Link
          href={itemHref(track.next)}
          className="mt-3 inline-block font-medium text-brand-600 hover:underline dark:text-brand-100"
        >
          Tiếp tục: {track.next.title} →
        </Link>
      )}
    </article>
  );
}
