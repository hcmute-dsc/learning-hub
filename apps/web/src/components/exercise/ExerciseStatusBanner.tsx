import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { ExerciseState, ItemRef } from '@hub/shared';
import { exerciseHref } from '@/components/learn/links';
import { EXERCISE_STATE_LABEL } from '@/lib/labels';
import { CheckIcon } from './CheckIcon';
import { TONE_CLASS, statusBanner } from './exercise-status';

/**
 * Colored message under the exercise title for states that need words: locked (with
 * links to the prerequisites), testing, in review, needs changes and completed. The
 * completed one "pops" its check mark once, as a small celebration.
 */
export function ExerciseStatusBanner({
  state,
  lockedBy,
}: {
  state: ExerciseState;
  lockedBy: ItemRef[];
}) {
  const banner = statusBanner(state);
  if (!banner) return null;
  const completed = state === 'completed';

  return (
    <div
      className={`motion-fade-up flex items-start gap-3 rounded-xl border p-4 text-sm ${TONE_CLASS[banner.tone]}`}
    >
      {completed ? (
        <span
          aria-hidden
          className="motion-pop grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-600 text-white shadow"
          style={{ '--i': 20 } as CSSProperties}
        >
          <CheckIcon className="h-5 w-5" />
        </span>
      ) : (
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/70 text-base dark:bg-black/25"
        >
          {EXERCISE_STATE_LABEL[state].icon}
        </span>
      )}
      <div className="min-w-0 pt-0.5">
        <p className="font-semibold">{banner.title}</p>
        <p className="mt-0.5">{banner.body}</p>
        {state === 'locked' && lockedBy.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {lockedBy.map((item) => (
              <li key={item.id}>
                <Link
                  href={exerciseHref(item.id)}
                  className="press inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 font-medium hover:border-brand-500"
                >
                  {item.title} <span aria-hidden>→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
