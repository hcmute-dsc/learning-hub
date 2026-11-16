'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { LessonProgressInput, LessonStatus, ProblemDetails } from '@hub/shared';
import { ProblemAlert } from '@/components/exercise/ProblemAlert';
import { sendJson } from '@/lib/client-api';

/**
 * "Đánh dấu đã học": PUT /lessons/:id/progress. The API also enrolls the member in the
 * track if needed, so reading a lesson never requires a separate enroll step.
 */
export function MarkLessonDone({ lessonId, status }: { lessonId: string; status: LessonStatus }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<ProblemDetails | null>(null);

  async function markDone() {
    setPending(true);
    setProblem(null);
    const body: LessonProgressInput = { status: 'completed' };
    const result = await sendJson(`/lessons/${encodeURIComponent(lessonId)}/progress`, 'PUT', body);
    setPending(false);
    if (!result.ok) {
      setProblem(result.problem);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <p aria-live="polite" className="sr-only">
        {status === 'completed' ? 'Bài học đã được đánh dấu là đã học.' : ''}
      </p>
      {status === 'completed' ? (
        <p className="font-medium text-emerald-700 dark:text-emerald-300">
          <span aria-hidden>✓ </span>Bạn đã học xong bài này.
        </p>
      ) : (
        <button
          type="button"
          onClick={markDone}
          disabled={pending}
          aria-busy={pending}
          className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? 'Đang lưu…' : 'Đánh dấu đã học'}
        </button>
      )}
      <ProblemAlert problem={problem} />
    </div>
  );
}
