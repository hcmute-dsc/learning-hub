'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { NextItem, TrackProgress } from '@hub/shared';
import { ProblemAlert } from '@/components/exercise/ProblemAlert';
import { sendJson } from '@/lib/client-api';
import { useMutation } from '@/lib/use-mutation';
import { itemHref } from './links';

/**
 * "Bắt đầu học" enrolls the member (POST /tracks/:slug/enrollments, idempotent on the
 * API side); once enrolled the same spot becomes "Tiếp tục" (USER-FLOWS §2). Both
 * `next` and `completed` come from GET /tracks/:slug/progress, so the rule lives in the API.
 */
export function EnrollButton({
  slug,
  enrolled,
  completed,
  next,
}: {
  slug: string;
  enrolled: boolean;
  completed: boolean;
  next: NextItem | null;
}) {
  const { run, busy, problem } = useMutation();
  // Filled from the enroll response, so the button changes on the first click even
  // before the refreshed page arrives (see lib/use-mutation.ts).
  const [justEnrolled, setJustEnrolled] = useState<TrackProgress | null>(null);
  const isEnrolled = enrolled || justEnrolled !== null;
  const nextItem = justEnrolled ? justEnrolled.next : next;
  const isCompleted = justEnrolled ? justEnrolled.status === 'completed' : completed;

  if (isEnrolled) {
    if (!nextItem) {
      // No next item and not completed only happens for a track with no items yet.
      return isCompleted ? (
        <p className="font-medium">
          <span aria-hidden>🎉 </span>Bạn đã hoàn thành lộ trình này.
        </p>
      ) : (
        <p className="muted">Lộ trình này chưa có bài học hay bài tập nào.</p>
      );
    }
    return (
      <Link
        href={itemHref(nextItem)}
        className="inline-block rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700"
      >
        Tiếp tục: {nextItem.title} →
      </Link>
    );
  }

  async function enroll() {
    const result = await run(() =>
      sendJson<TrackProgress>(`/tracks/${encodeURIComponent(slug)}/enrollments`, 'POST', {}),
    );
    if (result.ok) setJustEnrolled(result.data);
  }

  return (
    <div>
      <button
        type="button"
        onClick={enroll}
        disabled={busy}
        aria-busy={busy}
        className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {busy ? 'Đang ghi danh…' : 'Bắt đầu học'}
      </button>
      <ProblemAlert problem={problem} />
    </div>
  );
}
