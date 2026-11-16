'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import { linkSubmissionSchema, type LinkSubmissionInput, type SubmissionView } from '@hub/shared';
import { sendJson } from '@/lib/client-api';
import { SUBMISSION_STATUS_LABEL } from '@/lib/labels';
import { useMutation } from '@/lib/use-mutation';
import { CheckIcon } from './CheckIcon';
import { ProblemAlert } from './ProblemAlert';

/** Text field style shared by the URL and note fields. */
const FIELD_CLASS =
  'mt-1.5 w-full rounded-lg border bg-[var(--surface)] px-3 py-2 text-sm transition-colors hover:border-brand-500/60 focus:border-brand-500';

/**
 * Submit a link (code and project exercises): POST /exercises/:id/submissions.
 *
 * FRONTEND-DESIGN §7: one `Idempotency-Key` per submit attempt. A retry of the same
 * attempt (same URL and note, e.g. after a network error) reuses the key, so the API
 * never records the submission twice. Editing the form starts a new attempt.
 */
export function LinkSubmitForm({
  exerciseId,
  urlLabel,
  urlPlaceholder,
}: {
  exerciseId: string;
  urlLabel: string;
  urlPlaceholder: string;
}) {
  const { run, busy, problem, setProblem } = useMutation();
  const fieldId = useId();
  const attemptKey = useRef<string | null>(null);
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<SubmissionView | null>(null);

  function edit(setter: (value: string) => void, value: string) {
    setter(value);
    attemptKey.current = null;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setProblem(null);
    setSubmitted(null);

    // Same Zod schema as the API, so the member sees the error before sending.
    const parsed = linkSubmissionSchema.safeParse({ url, note: note.trim() || undefined });
    if (!parsed.success) {
      setUrlError('Hãy nhập một đường dẫn đầy đủ, bắt đầu bằng https://');
      return;
    }
    setUrlError(null);

    const key = (attemptKey.current ??= crypto.randomUUID());
    const body: LinkSubmissionInput = parsed.data;
    const result = await run(() =>
      sendJson<SubmissionView>(
        `/exercises/${encodeURIComponent(exerciseId)}/submissions`,
        'POST',
        body,
        { 'Idempotency-Key': key },
      ),
    );
    if (!result.ok) return;
    attemptKey.current = null;
    setSubmitted(result.data);
    setUrl('');
    setNote('');
  }

  const urlId = `${fieldId}-url`;
  const noteId = `${fieldId}-note`;
  const errorId = `${fieldId}-url-error`;

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <div>
        <label htmlFor={urlId} className="block text-sm font-medium">
          {urlLabel}
        </label>
        <input
          id={urlId}
          type="url"
          inputMode="url"
          required
          maxLength={500}
          value={url}
          onChange={(e) => edit(setUrl, e.target.value)}
          placeholder={urlPlaceholder}
          aria-invalid={urlError !== null}
          aria-describedby={urlError ? errorId : undefined}
          className={`${FIELD_CLASS} font-mono ${urlError ? 'border-red-500 dark:border-red-400' : 'border-[var(--border)]'}`}
        />
        {urlError && (
          <p id={errorId} className="motion-fade-up mt-1 text-sm text-red-700 dark:text-red-300">
            <span aria-hidden>⚠ </span>
            {urlError}
          </p>
        )}
      </div>
      <div>
        <label htmlFor={noteId} className="block text-sm font-medium">
          Ghi chú cho mentor <span className="muted font-normal">(không bắt buộc)</span>
        </label>
        <textarea
          id={noteId}
          rows={3}
          maxLength={2000}
          value={note}
          onChange={(e) => edit(setNote, e.target.value)}
          className={`${FIELD_CLASS} border-[var(--border)]`}
        />
      </div>

      <button
        type="submit"
        disabled={busy}
        aria-busy={busy}
        className="press w-full rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {busy ? 'Đang nộp…' : 'Nộp bài'}
      </button>

      <div aria-live="polite">
        {submitted && (
          <p className="flex items-start gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100">
            <span
              aria-hidden
              className="motion-pop grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-600 text-white"
            >
              <CheckIcon className="h-3.5 w-3.5" />
            </span>
            <span>
              Đã nộp lần thứ {submitted.attempt}. Trạng thái:{' '}
              {SUBMISSION_STATUS_LABEL[submitted.status]}.
            </span>
          </p>
        )}
      </div>
      <ProblemAlert problem={problem} />
    </form>
  );
}
