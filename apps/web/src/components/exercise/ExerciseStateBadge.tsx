import type { ExerciseState } from '@hub/shared';
import { EXERCISE_STATE_LABEL } from '@/lib/labels';

/** Color is extra; the icon + text carry the meaning (FRONTEND-DESIGN §9). */
const TONE: Record<ExerciseState, string> = {
  locked: 'border-[var(--border)] text-[var(--muted)]',
  not_started: 'border-[var(--border)] text-[var(--muted)]',
  attempted:
    'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200',
  testing:
    'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-200',
  in_review:
    'border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-200',
  needs_changes:
    'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-200',
  completed:
    'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200',
};

/** The one place that shows an ExerciseState (FRONTEND-DESIGN §4). */
export function ExerciseStateBadge({ state }: { state: ExerciseState }) {
  const label = EXERCISE_STATE_LABEL[state];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs whitespace-nowrap ${TONE[state]}`}
    >
      <span aria-hidden>{label.icon}</span>
      {label.text}
    </span>
  );
}
