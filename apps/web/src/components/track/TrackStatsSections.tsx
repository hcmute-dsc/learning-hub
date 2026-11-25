import Link from 'next/link';
import {
  TRACK_STATS_ACTIVE_DAYS,
  type TrackFunnelModule,
  type TrackStatsTotals,
  type TrackStatsWeek,
} from '@hub/shared';
import { formatHours } from '@/components/admin/report-format';
import { itemHref } from '@/components/learn/links';
import { barPercent, shareText, weekLabel } from './track-stats-format';

/**
 * Server components of /tracks/:slug/stats (learning-hub#118). Bars are plain divs with a
 * width in percent: no chart library. Every bar also shows its number, so the page works
 * without seeing the colours. The tables are in TrackStatsTables.tsx.
 */

function Card({ value, label, hint }: { value: string | number; label: string; hint?: string }) {
  return (
    <div className="surface rounded-xl p-4">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-sm">{label}</p>
      {hint && <p className="muted mt-0.5 text-xs">{hint}</p>}
    </div>
  );
}

export function SummaryCards({ totals }: { totals: TrackStatsTotals }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      <Card value={totals.enrolled} label="Người ghi danh" hint="không tính admin và mentor" />
      <Card
        value={totals.active}
        label="Đang học"
        hint={`đánh dấu bài học hoặc nộp bài trong ${TRACK_STATS_ACTIVE_DAYS} ngày qua`}
      />
      <Card
        value={`${totals.completed} (${totals.completionRate}%)`}
        label="Hoàn thành track"
        hint="trên số người ghi danh"
      />
      <Card value={totals.awaitingReview} label="Bài chờ review" hint="lúc xem trang" />
      <Card
        value={formatHours(totals.reviewHoursMedian)}
        label="Thời gian review trung vị"
        hint={`${totals.reviewsDone} review xong trong ${TRACK_STATS_ACTIVE_DAYS} ngày qua`}
      />
    </div>
  );
}

function Bar({ percent, tone = 'brand' }: { percent: number; tone?: 'brand' | 'soft' }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--border)]" aria-hidden>
      <div
        className={`h-full rounded-full ${tone === 'brand' ? 'bg-brand-600' : 'bg-brand-500/60'}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/** One module: its own row (everything done), then each lesson and exercise. */
export function Funnel({ modules, enrolled }: { modules: TrackFunnelModule[]; enrolled: number }) {
  if (modules.length === 0)
    return <p className="muted text-sm italic">Track chưa có chương nào.</p>;
  return (
    <ol className="space-y-5">
      {modules.map((m, i) => (
        <li key={m.slug} className="space-y-2">
          <div className="space-y-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
              <span className="font-semibold">
                Chương {i + 1}. {m.title}
              </span>
              <span className="muted tabular-nums">
                xong cả chương: {m.completed}/{enrolled} ({shareText(m.completed, enrolled)})
                <span className="sr-only"> người đã xong</span>
              </span>
            </div>
            <Bar percent={barPercent(m.completed, enrolled)} />
          </div>
          {m.items.length > 0 && (
            <ul className="space-y-1.5 border-l border-[var(--border)] pl-3">
              {m.items.map((item) => (
                <li key={item.id} className="space-y-0.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <Link href={itemHref(item)} className="min-w-0 truncate hover:underline">
                      <span className="muted mr-1 text-xs">
                        {item.kind === 'lesson' ? 'Bài học' : 'Bài tập'}
                      </span>
                      {item.title}
                    </Link>
                    <span className="muted shrink-0 tabular-nums">
                      {item.completed}
                      <span className="sr-only"> người đã xong</span>
                    </span>
                  </div>
                  <Bar percent={barPercent(item.completed, enrolled)} tone="soft" />
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}

/** Two thin bars per week: enrollments and active learners, against the week with the most. */
export function WeeklyChart({ weeks }: { weeks: TrackStatsWeek[] }) {
  const max = Math.max(0, ...weeks.flatMap((w) => [w.enrolled, w.active]));
  return (
    <div className="space-y-3">
      <p className="muted flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded-sm bg-brand-500/60" aria-hidden /> Ghi danh
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded-sm bg-brand-600" aria-hidden /> Đang học
        </span>
      </p>
      <ol className="space-y-2">
        {weeks.map((w) => (
          <li key={w.weekStart} className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-2">
            <span className="muted text-xs tabular-nums">{weekLabel(w.weekStart)}</span>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Bar percent={barPercent(w.enrolled, max)} tone="soft" />
                </div>
                <span className="w-8 text-right text-xs tabular-nums">
                  <span className="sr-only">Ghi danh: </span>
                  {w.enrolled}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Bar percent={barPercent(w.active, max)} />
                </div>
                <span className="w-8 text-right text-xs tabular-nums">
                  <span className="sr-only">Đang học: </span>
                  {w.active}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <p className="muted text-xs">
        Tuần tính từ thứ Hai, theo giờ Việt Nam; ngày là thứ Hai của tuần.
      </p>
    </div>
  );
}
