'use client';

import { useState, type FormEvent } from 'react';
import type { SelfCheckInput } from '@hub/shared';
import { sendJson } from '@/lib/client-api';
import { useMutation } from '@/lib/use-mutation';
import { ProblemAlert } from './ProblemAlert';

/**
 * Self-check exercise (INFORMATION-ARCHITECTURE §6): the member ticks every item of the
 * checklist, then confirms. The checklist is only a reminder on this page: the API never
 * sees it and accepts any `{ confirmed: true }` (`selfCheckSchema`), because self-check is
 * honour-based (USER-FLOWS). Keeping the button disabled until all is ticked is UX only.
 */
export function SelfCheckForm({
  exerciseId,
  checklist,
  completed: completedOnServer,
}: {
  exerciseId: string;
  checklist: string[];
  completed: boolean;
}) {
  const { run, busy, problem } = useMutation();
  const [savedNow, setSavedNow] = useState(false);
  // Done as soon as the API said yes, even before the refreshed page arrives.
  const completed = completedOnServer || savedNow;
  const [ticked, setTicked] = useState<boolean[]>(() => checklist.map(() => completed));

  const tickedCount = ticked.filter(Boolean).length;
  const allTicked = tickedCount === checklist.length;

  function setItem(index: number, on: boolean) {
    const copy = [...ticked];
    copy[index] = on;
    setTicked(copy);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const body: SelfCheckInput = { confirmed: true };
    const result = await run(() =>
      sendJson(`/exercises/${encodeURIComponent(exerciseId)}/self-check`, 'POST', body),
    );
    if (result.ok) setSavedNow(true);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <fieldset disabled={completed}>
        <legend className="font-medium">Tự kiểm tra trước khi xác nhận</legend>
        <ul className="mt-2 space-y-2">
          {checklist.map((item, index) => (
            <li key={`${index}-${item}`} className="flex items-start gap-2">
              <input
                id={`check-${index}`}
                type="checkbox"
                checked={ticked[index] ?? false}
                onChange={(e) => setItem(index, e.target.checked)}
                className="mt-1.5"
              />
              <label htmlFor={`check-${index}`}>{item}</label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div aria-live="polite">
        {completed && (
          <p className="font-medium text-emerald-700 dark:text-emerald-300">
            <span aria-hidden>✓ </span>Bạn đã hoàn thành bài tập này.
          </p>
        )}
      </div>
      <ProblemAlert problem={problem} />

      {!completed && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!allTicked || busy}
            aria-busy={busy}
            aria-describedby="self-check-count"
            className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? 'Đang lưu…' : 'Tôi đã hoàn thành'}
          </button>
          <span id="self-check-count" className="muted text-sm">
            Đã đánh dấu {tickedCount}/{checklist.length} mục
          </span>
        </div>
      )}
    </form>
  );
}
