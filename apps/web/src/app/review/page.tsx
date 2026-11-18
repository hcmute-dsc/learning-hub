import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { Me, ReviewQueue } from '@hub/shared';
import { QueueFilterForm } from '@/components/review/QueueFilterForm';
import { QueueStats } from '@/components/review/QueueStats';
import { ReviewQueueTable } from '@/components/review/ReviewQueueTable';
import { isFiltered, parseQueueFilter, queueQuery } from '@/components/review/queue-filter';
import { formatWaiting } from '@/components/review/review-form';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Review' };

/**
 * Mentor review queue (E7): project submissions waiting for a mentor, oldest first,
 * filtered by track and/or mentee from the URL, with the mentor dashboard numbers.
 * Mentors and admins only; everyone else gets the 404 page (the API checks again).
 */
export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ track?: string | string[]; mentee?: string | string[] }>;
}) {
  const { data: me } = await api<{ data: Me }>('/auth/me');
  if (!me.roles.includes('mentor') && !me.roles.includes('admin')) notFound();
  const filter = parseQueueFilter(await searchParams);
  const { data: queue } = await api<{ data: ReviewQueue }>(`/reviews/queue${queueQuery(filter)}`);

  return (
    <section className="space-y-6">
      <header className="motion-fade-up">
        <h1 className="text-2xl font-bold">Hàng đợi review</h1>
        <p className="muted mt-1 max-w-2xl text-sm">
          Bài dự án đang chờ mentor, bài nộp sớm nhất ở trên. Mục tiêu: review trong{' '}
          {formatWaiting(queue.targetHours)}. Nhận review để giữ bài, tránh hai mentor chấm cùng một
          bài.
        </p>
      </header>

      <QueueStats stats={queue.stats} />
      <QueueFilterForm filter={filter} options={queue.options} />

      {queue.items.length === 0 ? (
        <div className="surface motion-fade-up rounded-2xl p-10 text-center">
          {isFiltered(filter) ? (
            <>
              <p className="text-lg font-semibold">Không có bài nào khớp bộ lọc</p>
              <p className="muted mt-1 text-sm">Thử chọn track hoặc mentee khác, hoặc bỏ lọc.</p>
            </>
          ) : (
            <>
              <p className="text-4xl" aria-hidden>
                🎉
              </p>
              <p className="mt-3 text-lg font-semibold">Hết bài cần review</p>
              <p className="muted mt-1 text-sm">
                Khi thành viên nộp bài dự án, bài sẽ xuất hiện ở đây.
              </p>
            </>
          )}
        </div>
      ) : (
        <ReviewQueueTable items={queue.items} meId={me.id} />
      )}
    </section>
  );
}
