import Link from 'next/link';
import type { TrackProgress } from '@hub/shared';
import { countItems } from '@/components/dashboard/dashboard';
import { HexIcon } from '@/components/ui/HexIcon';
import { trackIconLabel } from '@/lib/track-icon';
import { ProgressBar } from './ProgressBar';

/**
 * One enrolled track in the dashboard's "Lộ trình của bạn" list (USER-FLOWS §2).
 * The whole row links to the track page; the "continue" link lives in the start cards.
 */
export function EnrollmentCard({ track }: { track: TrackProgress }) {
  const { done, total } = countItems(track);
  const completed = track.status === 'completed';
  return (
    <Link
      href={`/tracks/${track.slug}`}
      className="group flex items-center gap-3 p-4 transition-colors hover:bg-[var(--code-bg)]"
    >
      {/* TrackProgress has no tags, so the label comes from the title. */}
      <HexIcon label={trackIconLabel({ title: track.title })} size={48} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold group-hover:underline">{track.title}</span>
        <span className="mt-1.5 block">
          <ProgressBar percent={track.percent} label={`Tiến độ lộ trình ${track.title}`} />
        </span>
        <span className="muted mt-1 block text-xs">
          {completed ? '✓ Đã hoàn thành · ' : ''}
          {done} / {total} mục đã xong
          {track.cohort && ` · Đợt ${track.cohort}`}
        </span>
      </span>
      <span
        aria-hidden
        className="muted text-xl transition-transform group-hover:translate-x-1 group-hover:text-brand-600"
      >
        ›
      </span>
    </Link>
  );
}
