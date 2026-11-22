import Link from 'next/link';
import type { ReviewQueueItem } from '@hub/shared';
import { Avatar } from '@/components/ui/Avatar';
import { formatDateTime } from '@/lib/format';
import { ClaimButton } from './ClaimButton';
import { formatWaiting } from './review-form';

const ACTION_LINK =
  'press inline-block rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium whitespace-nowrap hover:border-brand-500';

/**
 * The review queue, oldest first (FRONTEND-DESIGN, E7). A row waiting longer than the
 * target gets an orange "Quá hạn" chip (words, not only color). The action depends on
 * who holds the review: claim it, continue your own, or just look.
 */
export function ReviewQueueTable({ items, meId }: { items: ReviewQueueItem[]; meId: string }) {
  return (
    <div className="overflow-x-auto md:rounded-xl md:border md:border-[var(--border)]">
      <table className="stack-table w-full md:min-w-[46rem] border-collapse text-left text-sm">
        <caption className="sr-only">Bài nộp đang chờ review, cũ nhất trước</caption>
        <thead className="bg-[var(--code-bg)]">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              Thành viên
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Bài tập
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Nộp lúc
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Đã chờ
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Người nhận
            </th>
            <th scope="col" className="px-3 py-2">
              <span className="sr-only">Thao tác</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const claimedByMe = item.openReview?.reviewer.id === meId;
            const isOwn = item.member.id === meId;
            return (
              <tr key={item.submissionId} className="border-[var(--border)] align-top md:border-t">
                <td className="py-1 md:px-3 md:py-2.5">
                  <span className="flex items-center gap-2">
                    <Avatar src={item.member.avatarUrl} size={28} />
                    <span className="min-w-0">
                      <span className="block font-medium">{item.member.displayName}</span>
                      <span className="muted block text-xs">@{item.member.githubLogin}</span>
                    </span>
                  </span>
                </td>
                <td data-label="Bài tập" className="py-1 md:px-3 md:py-2.5">
                  <span className="block font-medium">{item.exercise.title}</span>
                  <span className="muted block text-xs">
                    {item.track.title} · lần {item.attempt}
                  </span>
                </td>
                <td data-label="Nộp lúc" className="py-1 md:px-3 md:py-2.5 md:whitespace-nowrap">
                  <time dateTime={item.submittedAt}>{formatDateTime(item.submittedAt)}</time>
                </td>
                <td data-label="Đã chờ" className="py-1 md:px-3 md:py-2.5 md:whitespace-nowrap">
                  {formatWaiting(item.hoursWaiting)}
                  {item.overTarget && (
                    <span className="ml-2 rounded-full border border-orange-300 bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-900 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-100">
                      Quá hạn
                    </span>
                  )}
                </td>
                <td data-label="Người nhận" className="py-1 md:px-3 md:py-2.5">
                  {item.openReview ? (
                    <span className="flex items-center gap-1.5">
                      <Avatar src={item.openReview.reviewer.avatarUrl} size={20} />
                      {claimedByMe ? 'Bạn' : item.openReview.reviewer.displayName}
                    </span>
                  ) : (
                    <span className="muted">Chưa ai nhận</span>
                  )}
                </td>
                <td className="py-1 md:px-3 md:py-2.5 text-right">
                  {claimedByMe ? (
                    <Link
                      href={`/review/${item.submissionId}`}
                      prefetch={false}
                      className={`${ACTION_LINK} border-brand-500 text-brand-700`}
                    >
                      Tiếp tục <span aria-hidden>→</span>
                    </Link>
                  ) : item.openReview || isOwn ? (
                    <Link
                      href={`/review/${item.submissionId}`}
                      prefetch={false}
                      className={ACTION_LINK}
                    >
                      {isOwn ? 'Bài của bạn' : 'Xem'}
                    </Link>
                  ) : (
                    <ClaimButton submissionId={item.submissionId} openAfter compact />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
