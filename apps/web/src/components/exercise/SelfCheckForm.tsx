'use client';

import { useState, type CSSProperties, type FormEvent } from 'react';
import type { SelfCheckInput } from '@hub/shared';
import { sendJson } from '@/lib/client-api';
import { useMutation } from '@/lib/use-mutation';
import { CheckIcon } from './CheckIcon';
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
  const percent = checklist.length === 0 ? 0 : Math.round((tickedCount / checklist.length) * 100);

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
        <ul className="mt-3 space-y-2">
          {checklist.map((item, index) => (
            <li
              key={`${index}-${item}`}
              className="motion-fade-up"
              style={{ '--i': index } as CSSProperties}
            >
              <ChecklistCard
                id={`check-${index}`}
                text={item}
                checked={ticked[index] ?? false}
                readOnly={completed}
                onChange={(on) => setItem(index, on)}
              />
            </li>
          ))}
        </ul>
      </fieldset>

      <div aria-live="polite">
        {completed && (
          <p className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-300">
            <span
              aria-hidden
              className="motion-pop grid h-6 w-6 place-items-center rounded-full bg-emerald-600 text-white"
            >
              <CheckIcon />
            </span>
            Bạn đã hoàn thành bài tập này.
          </p>
        )}
      </div>
      <ProblemAlert problem={problem} />

      {!completed && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-3 text-sm">
            <div
              aria-hidden
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--border)]"
            >
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span id="self-check-count" className="muted shrink-0 tabular-nums">
              Đã đánh dấu {tickedCount}/{checklist.length} mục
            </span>
          </div>
          <button
            type="submit"
            disabled={!allTicked || busy}
            aria-busy={busy}
            aria-describedby="self-check-count"
            className="press w-full rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Đang lưu…' : 'Tôi đã hoàn thành'}
          </button>
        </div>
      )}
    </form>
  );
}

/** One checklist item as a large card; the real checkbox is visually hidden inside the label. */
function ChecklistCard({
  id,
  text,
  checked,
  readOnly,
  onChange,
}: {
  id: string;
  text: string;
  checked: boolean;
  readOnly: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-3 rounded-xl border-2 p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500 ${
        checked ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950' : 'border-[var(--border)]'
      } ${readOnly ? 'cursor-default' : 'press cursor-pointer hover:border-emerald-500'}`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 text-white transition-colors ${
          checked ? 'border-emerald-600 bg-emerald-600' : 'border-[var(--muted)]'
        }`}
      >
        {/* Mounting the icon on tick replays the pop animation each time. */}
        {checked && (
          <span className="motion-pop">
            <CheckIcon className="h-3.5 w-3.5" />
          </span>
        )}
      </span>
      <span className={checked ? 'text-emerald-950 dark:text-emerald-50' : ''}>{text}</span>
    </label>
  );
}
