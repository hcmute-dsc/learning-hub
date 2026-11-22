import type { ReportGroup, ReportMemberRow, ReportStats } from '@hub/shared';
import { formatDateTime } from '@/lib/format';
import { cohortLabel, formatHours } from './report-format';

/** Server components for /admin/reports: the totals, the per-group table, the per-member table. */

function Tile({ value, label, hint }: { value: string | number; label: string; hint?: string }) {
  return (
    <div className="surface rounded-xl p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm">{label}</p>
      {hint && <p className="muted mt-0.5 text-xs">{hint}</p>}
    </div>
  );
}

export function ReportTotals({ total }: { total: ReportStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Tile value={total.enrolled} label="Người ghi danh" hint="M1, tính tới cuối kỳ" />
      <Tile value={total.active} label="Người hoạt động" hint="M2, đánh dấu bài học hoặc nộp bài" />
      <Tile value={total.lessonsCompleted} label="Bài học xong" hint="M3, trong kỳ" />
      <Tile value={total.exercisesCompleted} label="Bài tập xong" hint="M4, lần đầu, trong kỳ" />
      <Tile
        value={`${total.atLeastFive} (${total.atLeastFiveRate}%)`}
        label="Người có ≥ 5 bài tập"
        hint="M5, tiêu chí 1"
      />
      <Tile
        value={`${total.completedTrack} (${total.completionRate}%)`}
        label="Hoàn thành track"
        hint="trên số lượt ghi danh"
      />
      <Tile value={total.awaitingReview} label="Bài chờ review" hint="M6, lúc xem trang" />
      <Tile
        value={formatHours(total.reviewHoursMedian)}
        label="Review trung vị"
        hint={`M7: ${total.reviewsDone} review, lâu nhất ${formatHours(total.reviewHoursMax)}; M8: ${total.reviewers} mentor`}
      />
    </div>
  );
}

const TH = 'py-2 pr-4 font-medium';
const TD = 'py-2 pr-4 tabular-nums';

export function GroupTable({ groups }: { groups: ReportGroup[] }) {
  return (
    <div className="table-wrap overflow-x-auto" tabIndex={0}>
      <table className="w-full min-w-[56rem] text-left text-sm">
        <thead className="muted">
          <tr className="border-b border-[var(--border)]">
            <th className={TH}>Track</th>
            <th className={TH}>Đợt</th>
            <th className={TH}>Ghi danh</th>
            <th className={TH}>Hoạt động</th>
            <th className={TH}>Bài học</th>
            <th className={TH}>Bài tập</th>
            <th className={TH}>≥ 5 bài</th>
            <th className={TH}>Hoàn thành</th>
            <th className={TH}>Chờ review</th>
            <th className="py-2 font-medium">Review (trung vị / lâu nhất)</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr
              key={`${g.track.slug}:${g.cohort ?? ''}`}
              className="border-b border-[var(--border)] last:border-0"
            >
              <td className="py-2 pr-4">{g.track.title}</td>
              <td className={`py-2 pr-4 ${g.cohort ? '' : 'muted italic'}`}>
                {cohortLabel(g.cohort)}
              </td>
              <td className={TD}>{g.enrolled}</td>
              <td className={TD}>{g.active}</td>
              <td className={TD}>{g.lessonsCompleted}</td>
              <td className={TD}>{g.exercisesCompleted}</td>
              <td className={TD}>
                {g.atLeastFive} ({g.atLeastFiveRate}%)
              </td>
              <td className={TD}>
                {g.completedTrack} ({g.completionRate}%)
              </td>
              <td className={TD}>{g.awaitingReview}</td>
              <td className="py-2 tabular-nums">
                {g.reviewsDone === 0
                  ? '—'
                  : `${formatHours(g.reviewHoursMedian)} / ${formatHours(g.reviewHoursMax)} (${g.reviewsDone})`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MemberTable({ members }: { members: ReportMemberRow[] }) {
  return (
    <div className="table-wrap overflow-x-auto" tabIndex={0}>
      <table className="w-full min-w-[56rem] text-left text-sm">
        <thead className="muted">
          <tr className="border-b border-[var(--border)]">
            <th className={TH}>GitHub</th>
            <th className={TH}>Track</th>
            <th className={TH}>Đợt</th>
            <th className={TH}>Bài học (kỳ · tổng)</th>
            <th className={TH}>Bài tập (kỳ · tổng)</th>
            <th className={TH}>Chờ review</th>
            <th className="py-2 font-medium">Hoạt động gần nhất</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr
              key={`${m.githubLogin}:${m.trackSlug}`}
              className="border-b border-[var(--border)] last:border-0"
            >
              <td className="py-2 pr-4">
                @{m.githubLogin}
                {m.completedAt && (
                  <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                    Hoàn thành
                  </span>
                )}
              </td>
              <td className="py-2 pr-4">{m.trackSlug}</td>
              <td className={`py-2 pr-4 ${m.cohort ? '' : 'muted italic'}`}>
                {cohortLabel(m.cohort)}
              </td>
              <td className={TD}>
                {m.lessonsInPeriod} · {m.lessonsDone}/{m.lessonsTotal}
              </td>
              <td className={TD}>
                {m.exercisesInPeriod} · {m.exercisesDone}/{m.exercisesTotal}
              </td>
              <td className={TD}>{m.awaitingReview}</td>
              <td className="py-2">
                {m.lastActiveAt ? formatDateTime(m.lastActiveAt) : <span className="muted">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
