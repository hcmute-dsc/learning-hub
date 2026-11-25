import Link from 'next/link';
import {
  TRACK_STATS_ACTIVE_DAYS,
  TRACK_STATS_INACTIVE_DAYS,
  type HardExercise,
  type InactiveLearner,
  type TrackFunnelModule,
  type TrackStatsTotals,
  type TrackStatsWeek,
  type WaitingReview,
} from '@hub/shared';
import { formatHours } from '@/components/admin/report-format';
import { exerciseHref, itemHref } from '@/components/learn/links';
import { formatDateTime } from '@/lib/format';
import {
  barPercent,
  lastActiveText,
  profileHref,
  shareText,
  waitingText,
  weekLabel,
} from './track-stats-format';

/**
 * Server components of /tracks/:slug/stats (learning-hub#118). Bars are plain divs with a
 * width in percent: no chart library. Every bar also shows its number, so the page works
 * without seeing the colours.
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
                    <span className="muted shrink-0 tabular-nums">{item.completed}</span>
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
                <span className="w-8 text-right text-xs tabular-nums">{w.enrolled}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Bar percent={barPercent(w.active, max)} />
                </div>
                <span className="w-8 text-right text-xs tabular-nums">{w.active}</span>
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

const TH = 'py-2 pr-4 font-medium';
const TD = 'py-1 tabular-nums md:py-2 md:pr-4';
const ROW = 'border-[var(--border)] md:border-b md:last:border-0';

export function FirstAttemptTable({ rows }: { rows: HardExercise[] }) {
  if (rows.length === 0) {
    return (
      <p className="muted text-sm italic">
        Chưa có bài tập chấm tự động (quiz, code) nào được nộp lần đầu.
      </p>
    );
  }
  return (
    <div className="table-wrap overflow-x-auto" tabIndex={0}>
      <table className="stack-table w-full text-left text-sm">
        <thead className="muted">
          <tr className="border-b border-[var(--border)]">
            <th className={TH}>Bài tập</th>
            <th className={TH}>Chương</th>
            <th className={TH}>Lần đầu chưa đạt</th>
            <th className="py-2 font-medium">Tỉ lệ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((x) => (
            <tr key={x.id} className={ROW}>
              <td className="py-1 font-medium md:py-2 md:pr-4">
                <Link href={exerciseHref(x.id)} className="hover:underline">
                  {x.title}
                </Link>
              </td>
              <td data-label="Chương" className="py-1 md:py-2 md:pr-4">
                {x.moduleTitle}
              </td>
              <td data-label="Chưa đạt" className={TD}>
                {x.failed}/{x.firstAttempts}
              </td>
              <td data-label="Tỉ lệ" className="py-1 tabular-nums md:py-2">
                {x.failRate}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WaitingReviewTable({ rows }: { rows: WaitingReview[] }) {
  if (rows.length === 0)
    return <p className="muted text-sm italic">Không có bài nào đang chờ review.</p>;
  return (
    <div className="table-wrap overflow-x-auto" tabIndex={0}>
      <table className="stack-table w-full text-left text-sm">
        <thead className="muted">
          <tr className="border-b border-[var(--border)]">
            <th className={TH}>Bài tập</th>
            <th className={TH}>Người nộp</th>
            <th className={TH}>Nộp lúc</th>
            <th className="py-2 font-medium">Đã chờ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.submissionId} className={ROW}>
              <td className="py-1 font-medium md:py-2 md:pr-4">
                <Link href={exerciseHref(r.exerciseId)} className="hover:underline">
                  {r.exerciseTitle}
                </Link>
              </td>
              <td data-label="Người nộp" className="py-1 md:py-2 md:pr-4">
                <Link href={profileHref(r.githubLogin)} className="hover:underline">
                  @{r.githubLogin}
                </Link>
              </td>
              <td data-label="Nộp lúc" className={TD}>
                {formatDateTime(r.submittedAt)}
              </td>
              <td data-label="Đã chờ" className="py-1 tabular-nums md:py-2">
                {waitingText(r.hoursWaiting)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InactiveTable({
  learners,
  total,
  now,
}: {
  learners: InactiveLearner[];
  total: number;
  now: Date;
}) {
  if (total === 0) {
    return (
      <p className="muted text-sm italic">
        Không có ai im lặng từ {TRACK_STATS_INACTIVE_DAYS} ngày trở lên.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {learners.length < total && (
        <p className="muted text-sm">
          Hiện {learners.length} trên {total} người, lâu không hoạt động nhất trước.
        </p>
      )}
      <div className="table-wrap overflow-x-auto" tabIndex={0}>
        <table className="stack-table w-full text-left text-sm">
          <thead className="muted">
            <tr className="border-b border-[var(--border)]">
              <th className={TH}>GitHub</th>
              <th className={TH}>Tiến độ</th>
              <th className={TH}>Hoạt động gần nhất</th>
              <th className="py-2 font-medium">Ghi danh</th>
            </tr>
          </thead>
          <tbody>
            {learners.map((l) => (
              <tr key={l.githubLogin} className={ROW}>
                <td className="py-1 font-medium md:py-2 md:pr-4">
                  <Link href={profileHref(l.githubLogin)} className="hover:underline">
                    @{l.githubLogin}
                  </Link>
                </td>
                <td data-label="Tiến độ" className={TD}>
                  {l.itemsDone}/{l.itemsTotal} ({l.progress}%)
                </td>
                <td
                  data-label="Gần nhất"
                  className={`${TD} ${l.lastActiveAt ? '' : 'muted italic'}`}
                >
                  {lastActiveText(l.lastActiveAt, now)}
                </td>
                <td data-label="Ghi danh" className="py-1 tabular-nums md:py-2">
                  {formatDateTime(l.enrolledAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
