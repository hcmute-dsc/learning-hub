import type { Difficulty, ExerciseType, TrackItemsProgress } from '@hub/shared';
import { ProgressBar } from '@/components/learn/ProgressBar';
import { ItemRow } from '@/components/track/ItemRow';
import { exerciseTone, lessonTone } from '@/components/track/track-items';
import {
  DIFFICULTY_LABEL,
  EXERCISE_STATE_LABEL,
  EXERCISE_TYPE_LABEL,
  LESSON_PROGRESS_LABEL,
} from '@/lib/labels';
import { exerciseHref, lessonHref, moduleAnchor } from './links';
import { countDone } from './track-progress';

export interface ModuleOutlineData {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  lessons: { id: string; title: string; estMinutes: number | null }[];
  exercises: { id: string; title: string; type: ExerciseType; difficulty: Difficulty }[];
}

/**
 * One module of a track as a card: number, title, its own progress, then its lessons
 * and exercises in reading order (INFORMATION-ARCHITECTURE §5). The card folds
 * (learning-hub#61): a native <details>, so it works without JavaScript and with the
 * keyboard; the header with the progress bar stays visible when folded.
 */
export function ModuleOutline({
  module,
  index,
  progress,
  enrolled,
  defaultOpen,
}: {
  module: ModuleOutlineData;
  index: number;
  progress: Pick<TrackItemsProgress, 'lessons' | 'exercises'>;
  /** Before enrolling every lesson is "not started"; showing that on each row is only noise. */
  enrolled: boolean;
  /** Open on first render; see openModuleIndex. */
  defaultOpen: boolean;
}) {
  const anchor = moduleAnchor(module.slug);
  const count = countDone([module], progress);
  const finished = enrolled && count.total > 0 && count.done === count.total;

  return (
    // The id is a stable anchor: lesson and exercise breadcrumbs link to /tracks/x#module-y.
    // scroll-mt keeps the module title below the sticky site header after the jump.
    <details
      id={anchor}
      open={defaultOpen}
      className="surface group scroll-mt-20 rounded-2xl p-4 sm:p-6"
    >
      <summary className="flex cursor-pointer list-none items-start gap-4 rounded-xl [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-mono font-bold ${
            finished
              ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950'
              : 'bg-brand-500/15 text-brand-600'
          }`}
        >
          {finished ? '✓' : String(index + 1).padStart(2, '0')}
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={`${anchor}-title`} className="text-lg font-semibold leading-snug">
            <span className="sr-only">Chương {index + 1}: </span>
            {module.title}
            {finished && <span className="sr-only"> (đã hoàn thành)</span>}
          </h3>
          {module.summary && <p className="muted mt-1 text-sm">{module.summary}</p>}
          {enrolled && count.total > 0 && (
            <div className="mt-3 flex items-center gap-3 text-sm">
              <div className="max-w-48 flex-1">
                <ProgressBar
                  percent={count.percent}
                  label={`Tiến độ chương ${module.title}`}
                  showValue={false}
                />
              </div>
              <span className="muted font-mono tabular-nums">
                {count.done}/{count.total}
              </span>
            </div>
          )}
        </div>
        <span
          aria-hidden
          className="muted mt-2 shrink-0 text-sm transition-transform group-open:rotate-180"
        >
          ▾
        </span>
      </summary>

      {count.total > 0 && (
        <ul className="mt-4 space-y-2">
          {module.lessons.map((l) => {
            const status = progress.lessons[l.id] ?? 'not_started';
            return (
              <ItemRow
                key={l.id}
                kind="lesson"
                href={lessonHref(l.id)}
                title={l.title}
                tone={lessonTone(status)}
                statusText={enrolled ? LESSON_PROGRESS_LABEL[status].text : null}
                meta={l.estMinutes ? `${l.estMinutes} phút` : null}
              />
            );
          })}
          {module.exercises.map((x) => {
            const state = progress.exercises[x.id] ?? 'not_started';
            return (
              <ItemRow
                key={x.id}
                kind="exercise"
                href={exerciseHref(x.id)}
                title={x.title}
                tone={exerciseTone(state)}
                // A lock is real even before enrolling, so exercise states always show.
                statusText={
                  enrolled || state !== 'not_started' ? EXERCISE_STATE_LABEL[state].text : null
                }
                meta={DIFFICULTY_LABEL[x.difficulty]}
                chip={EXERCISE_TYPE_LABEL[x.type]}
              />
            );
          })}
        </ul>
      )}
    </details>
  );
}
