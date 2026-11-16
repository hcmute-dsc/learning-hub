import type { CSSProperties } from 'react';
import { ProgressBar } from '@/components/learn/ProgressBar';
import { ProgressDots, ProgressLegend } from './ProgressDots';
import { countTones, type TrackItem } from './track-items';

/**
 * "Bạn đã hoàn thành X% lộ trình" with the dot grid (Exercism style). Before enrolling
 * the same grid is shown as a preview of what is ahead, so the page does not feel empty
 * and the member sees the size of the track before committing.
 */
export function ProgressPanel({
  items,
  percent,
  enrolled,
}: {
  items: TrackItem[];
  percent: number;
  enrolled: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <section
      aria-labelledby="track-progress-title"
      className="surface motion-fade-up rounded-2xl p-5 sm:p-6"
      style={{ '--i': 1 } as CSSProperties}
    >
      {enrolled ? (
        <>
          <h2 id="track-progress-title" className="text-lg font-semibold sm:text-xl">
            Bạn đã hoàn thành{' '}
            <span className="font-mono text-brand-600 tabular-nums">{percent}%</span> lộ trình
            {percent === 100 && <span aria-hidden> 🎉</span>}
          </h2>
          <div className="mt-3">
            <ProgressBar percent={percent} label="Tiến độ lộ trình" showValue={false} />
          </div>
        </>
      ) : (
        <>
          <h2 id="track-progress-title" className="text-lg font-semibold sm:text-xl">
            {items.length} chặng đường nhỏ đang chờ bạn
          </h2>
          <p className="muted mt-1 text-sm">
            Mỗi chấm là một bài học hoặc bài tập. Ghi danh để theo dõi tiến độ: chấm sẽ đổi thành
            dấu ✓ khi bạn hoàn thành.
          </p>
        </>
      )}

      <div className="mt-5">
        <ProgressDots items={items} />
        <ProgressLegend counts={countTones(items)} />
      </div>
    </section>
  );
}
