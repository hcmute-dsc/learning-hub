'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { NextItem, ProblemDetails } from '@hub/shared';
import { ProblemAlert } from '@/components/exercise/ProblemAlert';
import { sendJson } from '@/lib/client-api';
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
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<ProblemDetails | null>(null);

  if (enrolled) {
    if (!next) {
      // No next item and not completed only happens for a track with no items yet.
      return completed ? (
        <p className="font-medium">
          <span aria-hidden>🎉 </span>Bạn đã hoàn thành lộ trình này.
        </p>
      ) : (
        <p className="muted">Lộ trình này chưa có bài học hay bài tập nào.</p>
      );
    }
    return (
      <Link
        href={itemHref(next)}
        className="inline-block rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700"
      >
        Tiếp tục: {next.title} →
      </Link>
    );
  }

  async function enroll() {
    setPending(true);
    setProblem(null);
    const result = await sendJson(`/tracks/${encodeURIComponent(slug)}/enrollments`, 'POST', {});
    setPending(false);
    if (!result.ok) {
      setProblem(result.problem);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={enroll}
        disabled={pending}
        aria-busy={pending}
        className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? 'Đang ghi danh…' : 'Bắt đầu học'}
      </button>
      <ProblemAlert problem={problem} />
    </div>
  );
}
