'use client';

import { useId, useState, type FormEvent } from 'react';
import {
  REVIEW_OUTCOMES,
  REVIEW_SUMMARY_MAX,
  type CompleteReviewInput,
  type CompletedReview,
  type ReviewOutcome,
} from '@hub/shared';
import { ProblemAlert } from '@/components/exercise/ProblemAlert';
import { sendJson } from '@/lib/client-api';
import { REVIEW_OUTCOME_LABEL } from '@/lib/labels';
import { useMutation } from '@/lib/use-mutation';
import {
  emptyScores,
  liveTotal,
  parseScore,
  scoresToSend,
  validateReview,
  type ScoreDraft,
} from './review-form';

const FIELD_CLASS =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm transition-colors hover:border-brand-500/60 focus:border-brand-500';

const OUTCOME_HINT: Record<ReviewOutcome, string> = {
  approved: 'Bài đạt yêu cầu, thành viên hoàn thành bài tập.',
  changes_requested: 'Thành viên cần sửa theo nhận xét rồi nộp lại.',
};

/**
 * The mentor's review: a score per rubric criterion (0..weight) with the live total,
 * a Markdown summary and the outcome, sent with POST /reviews/:id/complete. Nothing is
 * saved before "Hoàn thành review", so nothing half-written ever reaches the member.
 */
export function ReviewForm({
  reviewId,
  rubric,
}: {
  reviewId: string;
  rubric: { criterion: string; weight: number }[];
}) {
  const { run, busy, problem, setProblem } = useMutation();
  const fieldId = useId();
  const [draft, setDraft] = useState<ScoreDraft>(() => emptyScores(rubric));
  const [summary, setSummary] = useState('');
  const [outcome, setOutcome] = useState<ReviewOutcome | null>(null);
  const [errors, setErrors] = useState<ReturnType<typeof validateReview>>({});
  const total = liveTotal(rubric, draft);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setProblem(null);
    const found = validateReview({ rubric, draft, outcome, summary });
    setErrors(found);
    if (Object.keys(found).length > 0 || !outcome) return;

    const body: CompleteReviewInput = {
      outcome,
      summaryMd: summary.trim(),
      ...(rubric.length ? { rubricScores: scoresToSend(rubric, draft) } : {}),
    };
    // On success the refreshed page shows the finished review instead of this form.
    await run(() =>
      sendJson<CompletedReview>(`/reviews/${encodeURIComponent(reviewId)}/complete`, 'POST', body),
    );
  }

  const summaryId = `${fieldId}-summary`;

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {rubric.length > 0 && (
        <fieldset>
          <legend className="text-sm font-semibold">Chấm theo rubric</legend>
          <ul className="mt-2 divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
            {rubric.map((row, index) => {
              const inputId = `${fieldId}-score-${index}`;
              const text = draft[row.criterion] ?? '';
              const invalid = text !== '' && parseScore(text, row.weight) === null;
              return (
                <li key={row.criterion} className="flex items-center gap-3 px-3 py-2">
                  <label htmlFor={inputId} className="min-w-0 flex-1 text-sm">
                    {row.criterion}
                  </label>
                  <input
                    id={inputId}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={row.weight}
                    step={1}
                    value={text}
                    onChange={(e) => setDraft({ ...draft, [row.criterion]: e.target.value })}
                    aria-invalid={invalid}
                    className={`w-20 rounded-md border bg-[var(--surface)] px-2 py-1 text-right font-mono text-sm tabular-nums ${
                      invalid ? 'border-red-500 dark:border-red-400' : 'border-[var(--border)]'
                    }`}
                  />
                  <span className="muted w-10 shrink-0 font-mono text-xs tabular-nums">
                    /{row.weight}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 flex items-baseline justify-between text-sm" aria-live="polite">
            <span className="muted">Tổng điểm</span>
            <span className="font-mono text-lg font-bold tabular-nums">{total.total}/100</span>
          </p>
          {errors.scores && <FieldError>{errors.scores}</FieldError>}
        </fieldset>
      )}

      <div>
        <label htmlFor={summaryId} className="block text-sm font-semibold">
          Nhận xét <span className="muted font-normal">(Markdown)</span>
        </label>
        <textarea
          id={summaryId}
          rows={8}
          maxLength={REVIEW_SUMMARY_MAX}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Điểm tốt, điều cần sửa, gợi ý tài liệu…"
          aria-invalid={!!errors.summary}
          className={`${FIELD_CLASS} mt-1.5`}
        />
        <p className="muted mt-1 text-right text-xs tabular-nums">
          {summary.length}/{REVIEW_SUMMARY_MAX}
        </p>
        {errors.summary && <FieldError>{errors.summary}</FieldError>}
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">Kết quả</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {REVIEW_OUTCOMES.map((value) => (
            <label
              key={value}
              className={`flex cursor-pointer gap-2 rounded-lg border p-3 text-sm transition-colors ${
                outcome === value
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-[var(--border)] hover:border-brand-500/60'
              }`}
            >
              <input
                type="radio"
                name={`${fieldId}-outcome`}
                value={value}
                checked={outcome === value}
                onChange={() => setOutcome(value)}
                className="mt-0.5"
              />
              <span>
                <span className="font-semibold">
                  <span aria-hidden>{REVIEW_OUTCOME_LABEL[value].icon} </span>
                  {REVIEW_OUTCOME_LABEL[value].text}
                </span>
                <span className="muted block text-xs">{OUTCOME_HINT[value]}</span>
              </span>
            </label>
          ))}
        </div>
        {errors.outcome && <FieldError>{errors.outcome}</FieldError>}
      </fieldset>

      <button
        type="submit"
        disabled={busy}
        aria-busy={busy}
        className="press w-full rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Đang gửi…' : 'Hoàn thành review'}
      </button>
      <ProblemAlert problem={problem} />
    </form>
  );
}

function FieldError({ children }: { children: string }) {
  return (
    <p className="motion-fade-up mt-1 text-sm text-red-700 dark:text-red-300">
      <span aria-hidden>⚠ </span>
      {children}
    </p>
  );
}
