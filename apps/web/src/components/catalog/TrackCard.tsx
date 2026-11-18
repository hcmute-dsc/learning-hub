import Link from 'next/link';
import type { TrackSummary } from '@hub/shared';
import { ProgressBar } from '@/components/learn/ProgressBar';
import { HexIcon } from '@/components/ui/HexIcon';
import { LEVEL_LABEL } from '@/lib/labels';
import { trackIconLabel } from '@/lib/track-icon';
import { toggleTagHref, type CatalogFilters } from './catalog';

/**
 * One track in the catalog grid, like Exercism's /tracks cards.
 * `percent` is set only when the member is enrolled in this track.
 *
 * Links cannot nest, so the title link is stretched over the whole card (`after:inset-0`,
 * `after:z-[1]` so animated children such as the progress bar stay under it)
 * and the tag links sit above it (`relative z-10`): a click on a tag filters the catalog,
 * a click anywhere else opens the track.
 */
export function TrackCard({
  track,
  filters,
  percent,
}: {
  track: TrackSummary;
  filters: CatalogFilters;
  percent?: number;
}) {
  return (
    <article className="surface lift group relative flex h-full flex-col rounded-2xl p-5 shadow-sm">
      <span className="flex items-start gap-4">
        <HexIcon
          label={trackIconLabel(track)}
          size={60}
          className="transition-transform duration-300 group-hover:rotate-6"
        />
        <span className="min-w-0">
          <Link
            href={`/tracks/${track.slug}`}
            className="block text-lg font-semibold group-hover:underline after:absolute after:inset-0 after:z-[1] after:rounded-2xl"
          >
            {track.title}
          </Link>
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
        {track.tags.map((tag) => {
          const selected = filters.tags.includes(tag);
          return (
            <Link
              key={tag}
              href={toggleTagHref(filters, tag)}
              aria-label={selected ? `Bỏ lọc theo chủ đề ${tag}` : `Lọc theo chủ đề ${tag}`}
              className={`relative z-10 rounded-full border px-2 py-0.5 text-xs ${
                selected
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'muted border-[var(--border)] hover:border-brand-500 hover:text-brand-700'
              }`}
            >
              {tag}
            </Link>
          );
        })}
      </span>

      {percent !== undefined && <EnrolledProgress title={track.title} percent={percent} />}
    </article>
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
