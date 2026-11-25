import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  TRACK_STATS_ACTIVE_DAYS,
  TRACK_STATS_DAYS_OPTIONS,
  type TrackFunnelModule,
  type TrackStatsTotals,
} from '@hub/shared';
import { formatHours } from '@/components/admin/report-format';
import { itemHref } from '@/components/learn/links';
import {
  barPercent,
  biggestDrop,
  change,
  changeText,
  itemSteps,
  shareText,
  statsHref,
  type Change,
} from './track-stats-format';

/**
 * Server components of /tracks/:slug/stats (learning-hub#118, redesigned in #126): period
 * picker, headline numbers with the change since the previous period, the chapter funnel,
 * the per-lesson detail and the empty state. The column charts are in ColumnChart.tsx, the
 * tables in TrackStatsTables.tsx. Every bar has its number in text beside it, so nothing is
 * told by colour alone.
 */

/** 7 / 14 / 30 / 90 days, as links (`?days=`): no client code, and the URL can be shared. */
export function PeriodPicker({ trackSlug, days }: { trackSlug: string; days: number }) {
  return (
    <nav aria-label="Khoảng thời gian">
      <ul className="surface inline-flex gap-1 rounded-xl p-1 text-sm">
        {TRACK_STATS_DAYS_OPTIONS.map((d) => (
          <li key={d}>
            <Link
              href={statsHref(trackSlug, d, TRACK_STATS_ACTIVE_DAYS)}
              scroll={false}
              aria-current={d === days ? 'page' : undefined}
              className={`block rounded-lg px-3 py-1.5 tabular-nums ${
                d === days
                  ? 'bg-brand-600 font-semibold text-white'
                  : 'muted hover:bg-black/5 hover:text-[var(--text)] dark:hover:bg-white/10'
              }`}
            >
              {d} ngày
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const CHANGE_CLASS = {
  good: 'text-emerald-700 dark:text-emerald-400',
  bad: 'text-red-700 dark:text-red-400',
  same: 'muted',
};

/**
 * "▲ +3 so với kỳ trước": arrow for the direction, colour for good or bad news, sign in text.
 * Without a number on one side: "Kỳ này chưa có review" or "Kỳ trước chưa có review".
 */
function ChangeLine({ value, unit, what }: { value: Change; unit?: string; what?: string }) {
  if (value.diff === null) {
    return <p className="muted mt-1 text-xs">{changeText(value, unit, what)}</p>;
  }
  return (
    <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${CHANGE_CLASS[value.tone]}`}>
      {value.diff !== 0 && (
        <svg viewBox="0 0 12 12" aria-hidden className="h-3 w-3" fill="currentColor">
          <path d={value.diff > 0 ? 'M6 2 11 9H1Z' : 'M6 10 1 3h10Z'} />
        </svg>
      )}
      {changeText(value, unit)}
    </p>
  );
}

function Kpi({
  label,
  value,
  detail,
  delta,
  hint,
  className = '',
}: {
  label: string;
  value: string | number;
  detail?: string;
  /** undefined = this number is not compared (a snapshot) */
  delta?: { value: Change; unit?: string; what?: string };
  hint: string;
  className?: string;
}) {
  return (
    <div className={`surface rounded-xl p-4 ${className}`}>
      <p className="muted text-sm">{label}</p>
      <p className="mt-1 text-2xl font-semibold">
        {value}
        {detail && <span className="muted ml-1.5 text-sm font-normal">{detail}</span>}
      </p>
      {delta && <ChangeLine {...delta} />}
      <p className="muted mt-1 text-xs">{hint}</p>
    </div>
  );
}

/** The five headline numbers of the period, each against the period before. */
export function KpiRow({
  totals,
  previous,
  days,
}: {
  totals: TrackStatsTotals;
  previous: TrackStatsTotals;
  days: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      <Kpi
        label="Người ghi danh"
        value={totals.enrolled}
        delta={{ value: change(totals.enrolled, previous.enrolled) }}
        hint="không tính admin và mentor"
      />
      <Kpi
        label="Đang học"
        value={totals.active}
        detail={`/ ${totals.enrolled}`}
        delta={{ value: change(totals.active, previous.active) }}
        hint={`đánh dấu bài học hoặc nộp bài trong ${days} ngày`}
      />
      <Kpi
        label="Hoàn thành track"
        value={`${totals.completionRate}%`}
        detail={`${totals.completed} người`}
        delta={{
          value: change(totals.completionRate, previous.completionRate),
          unit: 'điểm %',
        }}
        hint="trên số người ghi danh"
      />
      <Kpi label="Bài chờ review" value={totals.awaitingReview} hint="lúc xem trang" />
      <Kpi
        label="Review trung vị"
        value={formatHours(totals.reviewHoursMedian)}
        delta={{
          value: change(totals.reviewHoursMedian, previous.reviewHoursMedian, false),
          unit: 'giờ',
          what: 'review',
        }}
        hint={`từ lúc nộp tới lúc review xong; ${totals.reviewsDone} review trong ${days} ngày`}
        // five tiles in two columns on a phone: the last one takes the whole row
        className="col-span-2 sm:col-span-1"
      />
    </div>
  );
}

function WarningIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 2.5 14.5 13.5h-13Z" />
      <path d="M8 6.5v3M8 11.6v.1" />
    </svg>
  );
}

/** Amber badge with an icon: a warning is never colour alone. */
function WarningBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
      <WarningIcon />
      {children}
    </span>
  );
}

/** Chapters numbered like the track page, empty ones (no lesson nor exercise yet) left out. */
function numbered<M extends { items: unknown[] }>(modules: M[]) {
  return modules.map((m, i) => ({ ...m, number: i + 1 })).filter((m) => m.items.length > 0);
}

/**
 * One bar per chapter on the scale of the enrolled learners: solid = finished the whole
 * chapter, light = did at least one item of it. The chapter that the fewest learners of the
 * chapter before went on to start is marked (see `biggestDrop`).
 */
export function ChapterFunnel({
  modules,
  enrolled,
}: {
  modules: TrackFunnelModule[];
  enrolled: number;
}) {
  const chapters = numbered(modules);
  if (chapters.length === 0) {
    return <p className="muted text-sm italic">Track chưa có chương nào.</p>;
  }
  const drop = biggestDrop(chapters.map((m) => m.started));
  return (
    <div className="space-y-3">
      <ul className="muted flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-hidden>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--chart-2)]" />
          Xong cả chương
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--chart-2)] opacity-35" />
          Đã bắt đầu
        </li>
      </ul>
      <ol className="space-y-2">
        {chapters.map((m, i) => {
          const isDrop = drop?.index === i;
          return (
            <li
              key={m.slug}
              className={`space-y-1.5 rounded-lg px-2 py-1.5 ${isDrop ? 'bg-amber-50 ring-1 ring-amber-300 dark:bg-amber-500/10 dark:ring-amber-500/40' : ''}`}
            >
              {/* wraps on a phone so a long chapter title is never cut */}
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span className="min-w-0 font-medium">
                  {m.number}. {m.title}
                </span>
                <span className="shrink-0 tabular-nums">
                  <strong>{m.completed}</strong>
                  <span className="muted">
                    {' '}
                    xong ({shareText(m.completed, enrolled)}) · {m.started} bắt đầu
                  </span>
                </span>
              </div>
              <div aria-hidden className="relative h-3 overflow-hidden rounded bg-[var(--border)]">
                <div
                  className="absolute inset-y-0 left-0 rounded bg-[var(--chart-2)] opacity-35"
                  style={{ width: `${barPercent(m.started, enrolled)}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded bg-[var(--chart-2)]"
                  style={{ width: `${barPercent(m.completed, enrolled)}%` }}
                />
              </div>
              {isDrop && drop && (
                <p className="flex items-center gap-1 text-xs font-medium text-amber-900 dark:text-amber-200">
                  <WarningIcon />
                  Tụt mạnh nhất: {drop.before} người bắt đầu chương trước, {drop.after} bắt đầu
                  chương này (mất {shareText(drop.lost, drop.before)})
                </p>
              )}
            </li>
          );
        })}
      </ol>
      <p className="muted text-xs">
        Thanh dài hết cỡ = {enrolled} người ghi danh. Chi tiết từng bài ở mục bên dưới.
      </p>
    </div>
  );
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className="muted h-4 w-4 shrink-0 transition-transform group-open/chapter:rotate-90"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 3.5 4.5 4.5L6 12.5" />
    </svg>
  );
}

/**
 * Every lesson and exercise, grouped by chapter in collapsed <details> (60+ rows for the SQL
 * track would bury the page): how many finished it, the share kept from the item before,
 * and a badge where many stop.
 */
export function LessonDetail({
  modules,
  enrolled,
}: {
  modules: TrackFunnelModule[];
  enrolled: number;
}) {
  const chapters = itemSteps(numbered(modules));
  if (chapters.length === 0) {
    return <p className="muted text-sm italic">Track chưa có bài học nào.</p>;
  }
  return (
    <div className="divide-y divide-[var(--border)]">
      {chapters.map((m) => {
        const highDrops = m.items.filter((item) => item.highDrop).length;
        return (
          <details key={m.slug} className="group/chapter py-1">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 [&::-webkit-details-marker]:hidden">
              <Chevron />
              <span className="min-w-0 flex-1 truncate font-medium">
                Chương {m.number}. {m.title}
              </span>
              {highDrops > 0 && <WarningBadge>{highDrops} chỗ rời đi nhiều</WarningBadge>}
              <span className="muted shrink-0 hidden text-xs tabular-nums sm:inline">
                {m.items.length} mục
              </span>
            </summary>
            <ol className="space-y-3 pb-3 pl-6 pt-1">
              {m.items.map((item) => (
                <li key={item.id} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <Link href={itemHref(item)} className="min-w-0 truncate hover:underline">
                      <span className="muted mr-1 text-xs">
                        {item.kind === 'lesson' ? 'Bài học' : 'Bài tập'}
                      </span>
                      {item.title}
                    </Link>
                    <span className="shrink-0 tabular-nums">
                      <strong>{item.completed}</strong>
                      <span className="sr-only"> người đã xong</span>
                      {item.keptPercent !== null && (
                        <span className="muted">
                          {' '}
                          · {item.keptPercent > 100 ? 'tăng' : `${item.keptPercent}%`}
                          <span className="sr-only sm:not-sr-only">
                            {item.kind === 'lesson'
                              ? ' so với bài học trước'
                              : ' so với bài tập trước'}
                          </span>
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      aria-hidden
                      className="h-1.5 max-w-xs flex-1 overflow-hidden rounded-full bg-[var(--border)]"
                    >
                      <div
                        className="h-full rounded-full bg-[var(--chart-2)]"
                        style={{ width: `${barPercent(item.completed, enrolled)}%` }}
                      />
                    </div>
                    {item.highDrop && <WarningBadge>Rời đi nhiều</WarningBadge>}
                  </div>
                </li>
              ))}
            </ol>
          </details>
        );
      })}
    </div>
  );
}

/** Nobody enrolled yet: say what the page will show and how to get learners, not a wall of 0. */
export function EmptyStats({ trackSlug, trackTitle }: { trackSlug: string; trackTitle: string }) {
  return (
    <section
      aria-labelledby="stats-empty"
      className="surface mx-auto max-w-2xl space-y-4 rounded-2xl p-6 text-center sm:p-10"
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
        </svg>
      </div>
      <h2 id="stats-empty" className="text-lg font-semibold">
        Chưa có người học ghi danh track này
      </h2>
      <p className="muted text-sm">
        Khi thành viên HCMUTE DSC ghi danh <strong>{trackTitle}</strong>, trang này sẽ cho biết bao
        nhiêu người đang học, họ dừng ở chương nào và bài tập nào khó. Admin và mentor không được
        tính là người học.
      </p>
      <p className="muted text-sm">
        Để mời người học: gửi link trang track cho thành viên, họ đăng nhập bằng GitHub rồi bấm
        &quot;Bắt đầu học&quot; trên trang đó.
      </p>
      <p>
        <Link
          href={`/tracks/${trackSlug}`}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Mở trang track →
        </Link>
      </p>
    </section>
  );
}
