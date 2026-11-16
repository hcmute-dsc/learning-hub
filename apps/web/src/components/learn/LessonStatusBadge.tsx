import type { LessonStatus } from '@hub/shared';
import { LESSON_PROGRESS_LABEL } from '@/lib/labels';

const TONE: Record<LessonStatus, string> = {
  not_started: 'border-[var(--border)] text-[var(--muted)]',
  in_progress:
    'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-200',
  completed:
    'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200',
};

/** Reading status of a lesson; icon + text, never color only (FRONTEND-DESIGN §9). */
export function LessonStatusBadge({ status }: { status: LessonStatus }) {
  const label = LESSON_PROGRESS_LABEL[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs whitespace-nowrap ${TONE[status]}`}
    >
      <span aria-hidden>{label.icon}</span>
      {label.text}
    </span>
  );
}
