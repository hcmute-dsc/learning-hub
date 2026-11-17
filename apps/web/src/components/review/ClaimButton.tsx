'use client';

import { useRouter } from 'next/navigation';
import type { OpenReview } from '@hub/shared';
import { ProblemAlert } from '@/components/exercise/ProblemAlert';
import { sendJson } from '@/lib/client-api';
import { useMutation } from '@/lib/use-mutation';

/**
 * "Nhận review": POST /submissions/:id/reviews. From the queue it then opens the review
 * page; on the review page itself (`openAfter = false`) the refreshed page shows the form.
 * A 409 (someone else was faster) is shown as an error, and the refresh updates the row.
 */
export function ClaimButton({
  submissionId,
  openAfter,
  compact = false,
}: {
  submissionId: string;
  openAfter: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const { run, busy, problem } = useMutation();

  async function claim() {
    const result = await run(() =>
      sendJson<OpenReview>(`/submissions/${encodeURIComponent(submissionId)}/reviews`, 'POST'),
    );
    if (result.ok && openAfter) router.push(`/review/${submissionId}`);
  }

  return (
    <div>
      <button
        type="button"
        onClick={claim}
        disabled={busy}
        aria-busy={busy}
        className={`press rounded-lg bg-brand-600 font-semibold whitespace-nowrap text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 ${
          compact ? 'px-3 py-1.5 text-sm' : 'w-full px-4 py-2.5'
        }`}
      >
        {busy ? 'Đang nhận…' : 'Nhận review'}
      </button>
      <ProblemAlert problem={problem} />
    </div>
  );
}
