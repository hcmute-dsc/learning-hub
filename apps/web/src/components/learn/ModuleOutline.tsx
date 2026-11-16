import Link from 'next/link';
import type { Difficulty, ExerciseState, ExerciseType, LessonStatus } from '@hub/shared';
import { ExerciseStateBadge } from '@/components/exercise/ExerciseStateBadge';
import { EXERCISE_TYPE_LABEL } from '@/lib/labels';
import { LessonStatusBadge } from './LessonStatusBadge';
import { exerciseHref, lessonHref, moduleAnchor } from './links';

export interface ModuleOutlineData {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  lessons: { id: string; title: string; estMinutes: number | null }[];
  exercises: { id: string; title: string; type: ExerciseType; difficulty: Difficulty }[];
}

/**
 * One module of a track: its lessons, then its exercises (reading order), each with a
 * status badge when the member's progress is known (INFORMATION-ARCHITECTURE §5).
 */
export function ModuleOutline({
  module,
  index,
  lessonStatus,
  exerciseState,
}: {
  module: ModuleOutlineData;
  index: number;
  lessonStatus?: Record<string, LessonStatus>;
  exerciseState?: Record<string, ExerciseState>;
}) {
  return (
    // The id is a stable anchor: lesson and exercise breadcrumbs link to /tracks/x#module-y.
    <section
      id={moduleAnchor(module.slug)}
      aria-labelledby={`${moduleAnchor(module.slug)}-title`}
      className="surface scroll-mt-4 rounded-xl p-5"
    >
      <h2 id={`${moduleAnchor(module.slug)}-title`} className="font-semibold">
        <span className="muted font-mono">{String(index + 1).padStart(2, '0')}</span> {module.title}
      </h2>
      {module.summary && <p className="muted mt-1 text-sm">{module.summary}</p>}
      <ul className="mt-3 divide-y divide-[var(--border)] text-sm">
        {module.lessons.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <Link href={lessonHref(l.id)} className="min-w-0 hover:underline">
              <span aria-hidden>📖 </span>
              <span className="sr-only">Bài học: </span>
              {l.title}
            </Link>
            <span className="flex items-center gap-2">
              {l.estMinutes && <span className="muted">{l.estMinutes} phút</span>}
              {lessonStatus && <LessonStatusBadge status={lessonStatus[l.id] ?? 'not_started'} />}
            </span>
          </li>
        ))}
        {module.exercises.map((x) => (
          <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <Link href={exerciseHref(x.id)} className="min-w-0 hover:underline">
              <span aria-hidden>🛠️ </span>
              <span className="sr-only">Bài tập: </span>
              {x.title}
            </Link>
            <span className="flex items-center gap-2">
              <span className="muted">{EXERCISE_TYPE_LABEL[x.type]}</span>
              {exerciseState && <ExerciseStateBadge state={exerciseState[x.id] ?? 'not_started'} />}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
