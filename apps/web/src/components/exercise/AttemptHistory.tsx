import type { SubmissionView } from '@hub/shared';
import { formatDateTime, formatPercent } from '@/lib/format';
import { SUBMISSION_STATUS_LABEL } from '@/lib/labels';

/** Past attempts of one exercise, newest first as the API returns them (FRONTEND-DESIGN §2 AttemptHistory). */
export function AttemptHistory({ submissions }: { submissions: SubmissionView[] }) {
  return (
    <section aria-labelledby="attempt-history" className="surface rounded-xl p-5">
      <h2 id="attempt-history" className="font-semibold">
        Lịch sử nộp bài
      </h2>
      {submissions.length === 0 ? (
        <p className="muted mt-2 text-sm">Bạn chưa nộp bài này lần nào.</p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--border)] text-sm">
          {submissions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
              <span>
                <span className="font-mono">#{s.attempt}</span> ·{' '}
                {SUBMISSION_STATUS_LABEL[s.status]}
                {s.score !== null && ` · ${formatPercent(s.score)}`}
                {s.sourceUrl && (
                  <>
                    {' · '}
                    <a href={s.sourceUrl} rel="noopener noreferrer" className="underline">
                      Xem bài nộp
                    </a>
                  </>
                )}
              </span>
              <time dateTime={s.submittedAt} className="muted">
                {formatDateTime(s.submittedAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
