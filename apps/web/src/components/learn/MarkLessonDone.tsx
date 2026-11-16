'use client';

import { useState } from 'react';
import type { LessonProgressInput, LessonStatus } from '@hub/shared';
import { ProblemAlert } from '@/components/exercise/ProblemAlert';
import { sendJson } from '@/lib/client-api';
import { useMutation } from '@/lib/use-mutation';

/**
 * "Đánh dấu đã học": PUT /lessons/:id/progress. The API also enrolls the member in the
 * track if needed, so reading a lesson never requires a separate enroll step.
 */
export function MarkLessonDone({ lessonId, status }: { lessonId: string; status: LessonStatus }) {
  const { run, busy, problem } = useMutation();
  const [savedNow, setSavedNow] = useState(false);
  const done = status === 'completed' || savedNow;

  async function markDone() {
    const body: LessonProgressInput = { status: 'completed' };
    const result = await run(() =>
      sendJson(`/lessons/${encodeURIComponent(lessonId)}/progress`, 'PUT', body),
    );
    if (result.ok) setSavedNow(true);
  }

  return (
    <div>
      <p aria-live="polite" className="sr-only">
        {done ? 'Bài học đã được đánh dấu là đã học.' : ''}
      </p>
      {done ? (
        <p className="font-medium text-emerald-700 dark:text-emerald-300">
          <span aria-hidden>✓ </span>Bạn đã học xong bài này.
        </p>
      ) : (
        <button
          type="button"
          onClick={markDone}
          disabled={busy}
          aria-busy={busy}
          className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? 'Đang lưu…' : 'Đánh dấu đã học'}
        </button>
      )}
      <ProblemAlert problem={problem} />
    </div>
  );
}
