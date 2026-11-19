import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import type { ExerciseView, SubmissionView } from '@hub/shared';
import { AttemptHistory } from '@/components/exercise/AttemptHistory';
import { ExerciseActions } from '@/components/exercise/ExerciseActions';
import { ExerciseHeader } from '@/components/exercise/ExerciseHeader';
import { HintsPanel } from '@/components/exercise/HintsPanel';
import { bannerReview } from '@/components/exercise/exercise-status';
import { TrackSidebar } from '@/components/learn/TrackSidebar';
import { Markdown } from '@/components/markdown/Markdown';
import { apiOrNotFound } from '@/lib/api';
import { loadTrack, loadTrackProgress } from '@/lib/track';
import { trackIconLabel } from '@/lib/track-icon';

type Params = { params: Promise<{ id: string }> };

async function loadExercise(id: string): Promise<ExerciseView> {
  return (await apiOrNotFound<{ data: ExerciseView }>(`/exercises/${encodeURIComponent(id)}`)).data;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const exercise = await loadExercise(id);
  return { title: exercise.title };
}

/**
 * Exercise page (INFORMATION-ARCHITECTURE §6): the track outline on the left on 2xl
 * screens (as on the lesson page), then one centered column of reading width: the
 * statement, hints, the "Làm bài" panel and the attempt history.
 *
 * The panel used to sit in a 22rem column beside the statement, with its own scroll
 * bar. Rubrics, checklists and quiz questions were squeezed into it while the
 * statement column stayed half empty, so every type now stacks (learning-hub#65, #67).
 * The page itself scrolls; the quiz's "Nộp bài" bar (QuizForm) is sticky to the
 * bottom of the screen.
 */
export default async function ExercisePage({ params }: Params) {
  const { id } = await params;
  // Both calls map a bad id (422) or a missing exercise (404) to notFound(), so whichever
  // fails first, the member sees the 404 page and not the error page.
  const [exercise, submissions] = await Promise.all([
    loadExercise(id),
    apiOrNotFound<{ data: SubmissionView[] }>(
      `/me/submissions?${new URLSearchParams({ exerciseId: id })}`,
    ).then((r) => r.data),
  ]);
  const [track, progress] = await Promise.all([
    loadTrack(exercise.track.slug),
    loadTrackProgress(exercise.track.slug),
  ]);
  const sidebar = <TrackSidebar track={track} progress={progress} currentId={exercise.id} />;

  const statement = (
    <section aria-labelledby="statement-title" className="surface rounded-2xl p-5 sm:p-7">
      <PanelTitle id="statement-title" icon="📄">
        Đề bài
      </PanelTitle>
      {/* The API sends no source path for statements yet, so relative links stay as written. */}
      <Markdown source={exercise.statementMd} />
    </section>
  );
  const actions = (
    <section aria-labelledby="actions-title" className="surface rounded-2xl p-5">
      {/* Accent bar as an element: `.surface` sets the whole border, so a
          border-t utility would lose to it. */}
      <div aria-hidden className="-mx-5 -mt-5 mb-5 h-1 rounded-t-2xl bg-brand-500" />
      <PanelTitle id="actions-title" icon="✍️">
        Làm bài
      </PanelTitle>
      <ExerciseActions exercise={exercise} />
    </section>
  );
  const hints = <HintsPanel exercise={exercise} />;
  const history = <AttemptHistory submissions={submissions} />;

  return (
    // Wide page (see `.page-wide` in globals.css). The track outline gets its own column
    // only on 2xl screens; below that it folds into "Mục lục lộ trình".
    <div className="page-wide 2xl:grid 2xl:grid-cols-[16rem_minmax(0,1fr)] 2xl:gap-8">
      <aside className="hidden 2xl:block">
        <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2 pb-6">
          {sidebar}
        </div>
      </aside>

      <article className="min-w-0 space-y-6">
        <ExerciseHeader
          exercise={exercise}
          trackIcon={trackIconLabel(track)}
          review={bannerReview(exercise.state, submissions)}
        />

        <details className="surface rounded-xl p-4 2xl:hidden">
          <summary className="cursor-pointer font-medium">Mục lục lộ trình</summary>
          <div className="mt-3">{sidebar}</div>
        </details>

        <div className="mx-auto w-full max-w-3xl space-y-6">
          {/* Statement, then hints and the reference solution (PRD F11) under it. */}
          <div className="motion-fade-up space-y-6" style={{ '--i': 1 } as CSSProperties}>
            {statement}
            {hints}
          </div>
          <div className="motion-fade-up space-y-6" style={{ '--i': 2 } as CSSProperties}>
            {actions}
            {history}
          </div>
        </div>
      </article>
    </div>
  );
}

function PanelTitle({ id, icon, children }: { id: string; icon: string; children: string }) {
  return (
    <h2 id={id} className="mb-4 flex items-center gap-2 text-lg font-semibold">
      <span aria-hidden>{icon}</span>
      {children}
    </h2>
  );
}
