import type { CSSProperties } from 'react';
import Link from 'next/link';
import { ITEM_TONES, type ItemTone, type TrackItem } from './track-items';
import { TONE_DOT_CLASS, TONE_LABEL, ToneIcon } from './tone';

/**
 * One dot per lesson/exercise in reading order, like Exercism's track progress grid.
 * Each dot is a link, so a member can jump straight to any item.
 */
export function ProgressDots({ items }: { items: TrackItem[] }) {
  return (
    <ul aria-label="Các bài học và bài tập theo thứ tự" className="flex flex-wrap gap-1.5">
      {items.map((item, i) => {
        const label = `${item.kind === 'lesson' ? 'Bài học' : 'Bài tập'}: ${item.title} – ${item.statusText}`;
        return (
          // The pop-in animation lives on the <li> and the hover scale on the link: an
          // animation with fill-mode "both" would otherwise override the hover transform.
          // The stagger is capped so a long track does not take seconds to appear.
          <li
            key={item.id}
            className="motion-pop"
            style={{ '--i': Math.min(i, 60) } as CSSProperties}
          >
            <Link
              prefetch={false}
              href={item.href}
              aria-label={label}
              title={label}
              className={`grid h-6 w-6 place-items-center border-2 transition-transform duration-150 hover:scale-125 focus-visible:scale-125 ${
                // Lessons are round, exercises square: a second cue besides the tooltip.
                item.kind === 'lesson' ? 'rounded-full' : 'rounded-md'
              } ${TONE_DOT_CLASS[item.tone]}`}
            >
              <ToneIcon tone={item.tone} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Legend under the grid: a sample dot, the tone name and how many items have it. */
export function ProgressLegend({ counts }: { counts: Record<ItemTone, number> }) {
  return (
    <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
      {ITEM_TONES.map((tone) => (
        <li key={tone} className="flex items-center gap-2">
          <span
            aria-hidden
            className={`grid h-4 w-4 place-items-center rounded-full border-2 ${TONE_DOT_CLASS[tone]}`}
          >
            <ToneIcon tone={tone} className="h-2.5 w-2.5" />
          </span>
          {TONE_LABEL[tone]}
          <span className="muted font-mono tabular-nums">{counts[tone]}</span>
        </li>
      ))}
      <li className="muted flex items-center gap-2">
        <span aria-hidden className="h-3 w-3 rounded-full border-2 border-current" />
        Bài học
        <span aria-hidden className="ml-2 h-3 w-3 rounded-sm border-2 border-current" />
        Bài tập
      </li>
    </ul>
  );
}
