import Link from 'next/link';
import type { ExerciseView } from '@hub/shared';
import { Breadcrumbs } from '@/components/learn/Breadcrumbs';
import { lessonHref, moduleHref } from '@/components/learn/links';
import { DIFFICULTY_LABEL, EXERCISE_TYPE_LABEL } from '@/lib/labels';
import { ExerciseStateBadge } from './ExerciseStateBadge';

/** Title, type, difficulty and state of an exercise (INFORMATION-ARCHITECTURE §6 header). */
export function ExerciseHeader({ exercise }: { exercise: ExerciseView }) {
  return (
    <header>
      <Breadcrumbs
        items={[
          { label: 'Lộ trình', href: '/tracks' },
          { label: exercise.track.title, href: `/tracks/${exercise.track.slug}` },
          {
            label: exercise.module.title,
            href: moduleHref(exercise.track.slug, exercise.module.slug),
          },
        ]}
      />
      <h1 className="mt-2 text-3xl font-bold">{exercise.title}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <ExerciseStateBadge state={exercise.state} />
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
          {EXERCISE_TYPE_LABEL[exercise.type]}
        </span>
        <span className="muted rounded-full border border-[var(--border)] px-2 py-0.5 text-xs">
          Độ khó: {DIFFICULTY_LABEL[exercise.difficulty]}
        </span>
        {exercise.requiresReview && (
          <span className="muted rounded-full border border-[var(--border)] px-2 py-0.5 text-xs">
            Có mentor review
          </span>
        )}
        {exercise.attempts > 0 && <span className="muted">· {exercise.attempts} lần nộp</span>}
      </div>
      {exercise.lesson && (
        <p className="muted mt-2 text-sm">
          Thuộc bài học:{' '}
          <Link href={lessonHref(exercise.lesson.id)} className="underline">
            {exercise.lesson.title}
          </Link>
        </p>
      )}
    </header>
  );
}
