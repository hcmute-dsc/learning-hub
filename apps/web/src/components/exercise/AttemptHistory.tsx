import type { CSSProperties } from 'react';
import type { SubmissionView } from '@hub/shared';
import { formatDateTime, formatPercent } from '@/lib/format';
import { SUBMISSION_STATUS_LABEL } from '@/lib/labels';
import { TONE_CLASS, submissionTone, type Tone } from './exercise-status';

/** Color of the timeline dot; the status pill next to it says the same in words. */
const DOT_CLASS: Record<Tone, string> = {
  neutral: 'bg-[var(--muted)]',
  info: 'bg-sky-500',
  review: 'bg-violet-500',
  warning: 'bg-orange-500',
  success: 'bg-emerald-500',
  danger: 'bg-red-500',
};

/**
 * Past attempts of one exercise as a compact timeline, newest first as the API returns
 * them (FRONTEND-DESIGN §2 AttemptHistory).
 */
export function AttemptHistory({ submissions }: { submissions: SubmissionView[] }) {
  return (
    <section aria-labelledby="attempt-history" className="surface rounded-2xl p-5">
      <h2 id="attempt-history" className="flex items-center justify-between gap-2 font-semibold">
        Lịch sử nộp bài
        {submissions.length > 0 && (
          <span className="muted rounded-full bg-[var(--code-bg)] px-2 py-0.5 font-mono text-xs font-normal">
            {submissions.length}
          </span>
        )}
      </h2>
      {submissions.length === 0 ? (
        <p className="muted mt-2 text-sm">Bạn chưa nộp bài này lần nào.</p>
      ) : (
        <ol className="mt-4 ml-1.5 space-y-4 border-l-2 border-[var(--border)] text-sm">
          {submissions.map((s, index) => {
            const tone = submissionTone(s.status);
            return (
              <li
                key={s.id}
                className="motion-fade-up relative pl-5"
                style={{ '--i': index } as CSSProperties}
              >
                <span
                  aria-hidden
                  className={`absolute top-1 -left-[7px] h-3 w-3 rounded-full ring-4 ring-[var(--surface)] ${DOT_CLASS[tone]}`}
                />
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="font-medium">Lần {s.attempt}</span>
                  <time dateTime={s.submittedAt} className="muted text-xs">
                    {formatDateTime(s.submittedAt)}
                  </time>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${TONE_CLASS[tone]}`}>
                    {SUBMISSION_STATUS_LABEL[s.status]}
                  </span>
                  {s.score !== null && (
                    <span className="font-mono text-xs tabular-nums">{formatPercent(s.score)}</span>
                  )}
                  {s.sourceUrl && (
                    <a
                      href={s.sourceUrl}
                      rel="noopener noreferrer"
                      className="text-xs underline underline-offset-2 hover:text-brand-700"
                    >
                      Xem bài nộp<span className="sr-only"> lần {s.attempt}</span>
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
