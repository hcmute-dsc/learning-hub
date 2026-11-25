import Link from 'next/link';
import {
  TRACK_STATS_INACTIVE_DAYS,
  type HardExercise,
  type InactiveLearner,
  type WaitingReview,
} from '@hub/shared';
import { exerciseHref } from '@/components/learn/links';
import { formatDateTime } from '@/lib/format';
import { lastActiveText, profileHref, waitingText } from './track-stats-format';

/**
 * The tables of /tracks/:slug/stats (learning-hub#118): hardest exercises by first attempt,
 * longest waiting reviews, and learners who have gone quiet. Phone: one card per row
 * (`stack-table`); from md: a normal table.
 */

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
        Không có học viên nào ngừng hoạt động từ {TRACK_STATS_INACTIVE_DAYS} ngày trở lên.
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
