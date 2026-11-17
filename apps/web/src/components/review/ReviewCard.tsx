import type { CompletedReview } from '@hub/shared';
import { TONE_CLASS } from '@/components/exercise/exercise-status';
import { Markdown } from '@/components/markdown/Markdown';
import { Avatar } from '@/components/ui/Avatar';
import { formatDateTime } from '@/lib/format';
import { REVIEW_OUTCOME_LABEL } from '@/lib/labels';

/**
 * A finished mentor review: outcome, rubric total, reviewer, summary (Markdown) and the
 * score per criterion. Shown to the member under their attempt and to mentors on the
 * review page. `id` makes it a link target ("Xem nhận xét").
 */
export function ReviewCard({ review, id }: { review: CompletedReview; id?: string }) {
  const label = REVIEW_OUTCOME_LABEL[review.outcome];
  const tone = review.outcome === 'approved' ? 'success' : 'warning';
  return (
    <div id={id} className="mt-2 scroll-mt-24 rounded-lg border border-[var(--border)] p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full border px-2 py-0.5 font-medium ${TONE_CLASS[tone]}`}>
          <span aria-hidden>{label.icon} </span>
          Mentor: {label.text}
        </span>
        {review.rubricTotal !== null && (
          <span className="font-mono font-semibold tabular-nums">{review.rubricTotal}/100</span>
        )}
        <span className="muted flex items-center gap-1.5">
          <Avatar src={review.reviewer.avatarUrl} size={18} />
          {review.reviewer.displayName}
          <span aria-hidden>·</span>
          <time dateTime={review.completedAt}>{formatDateTime(review.completedAt)}</time>
        </span>
      </div>
      {review.summaryMd && (
        <div className="mt-2 text-sm">
          {/* Written by a mentor, still sanitized like all Markdown (SECURITY §3). */}
          <Markdown source={review.summaryMd} />
        </div>
      )}
      {review.rubricScores.length > 0 && (
        <details className="mt-2 text-xs">
          <summary className="muted cursor-pointer">Điểm từng tiêu chí</summary>
          <ul className="mt-1.5 space-y-1">
            {review.rubricScores.map((s) => (
              <li key={s.criterion} className="flex justify-between gap-3">
                <span>{s.criterion}</span>
                <span className="font-mono whitespace-nowrap tabular-nums">
                  {s.score}/{s.weight}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** Anchor id of a submission's review, shared by the banner link and the card. */
export const reviewAnchor = (submissionId: string) => `review-${submissionId}`;
