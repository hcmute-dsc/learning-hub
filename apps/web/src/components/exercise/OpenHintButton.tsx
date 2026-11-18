'use client';

import type { HintView } from '@hub/shared';
import { sendJson } from '@/lib/client-api';
import { useMutation } from '@/lib/use-mutation';
import { ProblemAlert } from './ProblemAlert';

/**
 * Opens the next hint. The API records who opened which hint and returns its text; the
 * refreshed page then shows it in the list above (useMutation reloads the server data).
 */
export function OpenHintButton({
  exerciseId,
  position,
  label,
}: {
  exerciseId: string;
  position: number;
  label: string;
}) {
  const { run, busy, problem } = useMutation();

  async function open() {
    await run(() =>
      sendJson<HintView>(`/exercises/${encodeURIComponent(exerciseId)}/hints/${position}`, 'POST'),
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={open}
        disabled={busy}
        aria-busy={busy}
        className="press rounded-lg border-2 border-amber-400 px-4 py-2 font-semibold text-amber-900 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-amber-100 dark:hover:bg-amber-950"
      >
        <span aria-hidden>💡 </span>
        {busy ? 'Đang mở…' : label}
      </button>
      <ProblemAlert problem={problem} />
    </div>
  );
}
