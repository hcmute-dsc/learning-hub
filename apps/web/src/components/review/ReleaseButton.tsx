'use client';

import { useRouter } from 'next/navigation';
import { ProblemAlert } from '@/components/exercise/ProblemAlert';
import { sendJson } from '@/lib/client-api';
import { useMutation } from '@/lib/use-mutation';

/**
 * "Bỏ nhận": DELETE /reviews/:id gives the submission back to the queue, then goes back
 * to the queue. The reviewer uses it, or an admin to free a forgotten claim.
 */
export function ReleaseButton({
  reviewId,
  label = 'Bỏ nhận',
}: {
  reviewId: string;
  label?: string;
}) {
  const router = useRouter();
  const { run, busy, problem } = useMutation();

  async function release() {
    if (!window.confirm('Bỏ nhận review này? Bài nộp sẽ quay lại hàng đợi.')) return;
    const result = await run(() =>
      sendJson<void>(`/reviews/${encodeURIComponent(reviewId)}`, 'DELETE'),
    );
    if (result.ok) router.push('/review');
  }

  return (
    <div>
      <button
        type="button"
        onClick={release}
        disabled={busy}
        aria-busy={busy}
        className="press rounded-lg border border-[var(--border)] px-4 py-2.5 font-medium hover:border-red-500 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:text-red-300"
      >
        {busy ? 'Đang bỏ nhận…' : label}
      </button>
      <ProblemAlert problem={problem} />
    </div>
  );
}
