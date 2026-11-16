import Link from 'next/link';
import type { TrackSummary } from '@hub/shared';
import { ProgressBar } from '@/components/learn/ProgressBar';
import { HexIcon } from '@/components/ui/HexIcon';
import { LEVEL_LABEL } from '@/lib/labels';
import { trackIconLabel } from '@/lib/track-icon';

/**
 * One track in the catalog grid, like Exercism's /tracks cards.
 * `percent` is set only when the member is enrolled in this track.
 */
export function TrackCard({ track, percent }: { track: TrackSummary; percent?: number }) {
  return (
    <Link
      href={`/tracks/${track.slug}`}
      className="surface lift group flex h-full flex-col rounded-2xl p-5 shadow-sm"
    >
      <span className="flex items-start gap-4">
        <HexIcon
          label={trackIconLabel(track)}
          size={60}
          className="transition-transform duration-300 group-hover:rotate-6"
        />
        <span className="min-w-0">
          <span className="block text-lg font-semibold group-hover:underline">{track.title}</span>
          <span className="muted mt-0.5 block text-sm">
            {track.lessonCount} bài học · {track.exerciseCount} bài tập
            {track.estHours ? ` · ~${track.estHours} giờ` : ''}
          </span>
        </span>
      </span>

      {track.summary && <span className="muted mt-3 line-clamp-2 text-sm">{track.summary}</span>}

      <span className="mt-3 flex flex-1 flex-wrap content-start gap-1.5">
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
          {LEVEL_LABEL[track.level]}
        </span>
        {track.tags.map((tag) => (
          <span
            key={tag}
            className="muted rounded-full border border-[var(--border)] px-2 py-0.5 text-xs"
          >
            {tag}
          </span>
        ))}
      </span>

      {percent !== undefined && <EnrolledProgress title={track.title} percent={percent} />}
    </Link>
  );
}

function EnrolledProgress({ title, percent }: { title: string; percent: number }) {
  return (
    <span className="mt-4 block border-t border-[var(--border)] pt-3">
      <span className="text-xs font-medium text-brand-600">
        {percent >= 100 ? '✓ Đã hoàn thành' : `Đang học ${Math.round(percent)}%`}
      </span>
      <span className="mt-1 block">
        <ProgressBar percent={percent} label={`Tiến độ lộ trình ${title}`} showValue={false} />
      </span>
    </span>
  );
}
