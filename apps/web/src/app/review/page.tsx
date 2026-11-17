import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { Me, ReviewQueue } from '@hub/shared';
import { ReviewQueueTable } from '@/components/review/ReviewQueueTable';
import { formatWaiting } from '@/components/review/review-form';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Review' };

/**
 * Mentor review queue (E7): project submissions waiting for a mentor, oldest first.
 * Mentors and admins only; everyone else gets the 404 page (the API checks again).
 */
export default async function ReviewQueuePage() {
  const { data: me } = await api<{ data: Me }>('/auth/me');
  if (!me.roles.includes('mentor') && !me.roles.includes('admin')) notFound();
  const { data: queue } = await api<{ data: ReviewQueue }>('/reviews/queue');
  const overdue = queue.items.filter((i) => i.overTarget).length;

  return (
    <section className="space-y-6">
      <header className="motion-fade-up">
        <h1 className="text-2xl font-bold">Hàng đợi review</h1>
        <p className="muted mt-1 max-w-2xl text-sm">
          Bài dự án đang chờ mentor, bài nộp sớm nhất ở trên. Mục tiêu: review trong{' '}
          {formatWaiting(queue.targetHours)}. Nhận review để giữ bài, tránh hai mentor chấm cùng một
          bài.
        </p>
        {queue.items.length > 0 && (
          <p className="mt-3 text-sm">
            <span className="font-semibold">{queue.items.length}</span> bài đang chờ
            {overdue > 0 && (
              <>
                , trong đó{' '}
                <span className="font-semibold text-orange-700 dark:text-orange-300">
                  {overdue} bài quá hạn
                </span>
              </>
            )}
            .
          </p>
        )}
      </header>

      {queue.items.length === 0 ? (
        <div className="surface motion-fade-up rounded-2xl p-10 text-center">
          <p className="text-4xl" aria-hidden>
            🎉
          </p>
          <p className="mt-3 text-lg font-semibold">Hết bài cần review</p>
          <p className="muted mt-1 text-sm">
            Khi thành viên nộp bài dự án, bài sẽ xuất hiện ở đây.
          </p>
        </div>
      ) : (
        <ReviewQueueTable items={queue.items} meId={me.id} />
      )}
    </section>
  );
}
