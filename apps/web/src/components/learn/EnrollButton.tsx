'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { NextItem, TrackProgress } from '@hub/shared';
import { ProblemAlert } from '@/components/exercise/ProblemAlert';
import { sendJson } from '@/lib/client-api';
import { useMutation } from '@/lib/use-mutation';
import { itemHref } from './links';

/** Main call to action of the track page; `.press` gives the click a small push-in. */
const CTA_CLASS =
  'press group/enroll inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white shadow-md shadow-brand-600/25 hover:bg-brand-700';

function Arrow() {
  return (
    <span
      aria-hidden
      className="transition-transform duration-200 group-hover/enroll:translate-x-1"
    >
      →
    </span>
  );
}

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
        <p className="inline-flex items-center gap-2 rounded-xl border border-emerald-600/40 bg-emerald-600/10 px-4 py-2.5 font-medium text-emerald-800 dark:text-emerald-200">
          <span aria-hidden>🎉</span>Bạn đã hoàn thành lộ trình này.
        </p>
      ) : (
        <p className="muted">Lộ trình này chưa có bài học hay bài tập nào.</p>
      );
    }
    return (
      <Link href={itemHref(nextItem)} className={`${CTA_CLASS} max-w-full`}>
        <span className="truncate">Tiếp tục: {nextItem.title}</span>
        <Arrow />
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
        className={`${CTA_CLASS} disabled:cursor-wait disabled:opacity-60`}
      >
        {busy ? 'Đang ghi danh…' : 'Bắt đầu học'}
        {!busy && <Arrow />}
      </button>
      <ProblemAlert problem={problem} />
    </div>
  );
}
