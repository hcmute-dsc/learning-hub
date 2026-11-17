import Link from 'next/link';
import type { LessonView } from '@hub/shared';
import { ExerciseStateBadge } from '@/components/exercise/ExerciseStateBadge';
import { EXERCISE_TYPE_LABEL } from '@/lib/labels';
import { exerciseHref } from './links';

/**
 * "Bài tập liên quan" block of a lesson page (INFORMATION-ARCHITECTURE §5). It sits under
 * the "Đánh dấu đã học" button inside the same card, so it only draws a divider line.
 */
export function RelatedExercises({ exercises }: { exercises: LessonView['exercises'] }) {
  if (exercises.length === 0) return null;
  return (
    <section aria-labelledby="related-exercises" className="border-t border-[var(--border)] pt-5">
      <h2 id="related-exercises" className="font-semibold">
        Bài tập liên quan
      </h2>
      <ul className="mt-3 divide-y divide-[var(--border)] text-sm">
        {exercises.map((x) => (
          <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <Link prefetch={false} href={exerciseHref(x.id)} className="hover:underline">
              <span aria-hidden>🛠️ </span>
              {x.title}
            </Link>
            <span className="flex items-center gap-2">
              <span className="muted">{EXERCISE_TYPE_LABEL[x.type]}</span>
              <ExerciseStateBadge state={x.state} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
