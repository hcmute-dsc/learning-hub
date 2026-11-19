import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';
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
 * Exercise page (INFORMATION-ARCHITECTURE §6), laid out like Exercism's: the track
 * outline on the left (as on the lesson page), then the statement and the "Làm bài"
 * panel side by side on extra-wide screens, the panel staying in view while the
 * statement scrolls. Smaller screens stack them, statement first.
 *
 * A quiz is the exception: its questions are the content and its statement is a line
 * or two, so it gets one centered column (learning-hub#65) instead of a narrow panel
 * with its own scroll bar beside an almost empty statement.
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
    // only on 2xl screens; below that the statement and the "Làm bài" panel share the
    // width and the outline folds into "Mục lục lộ trình".
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

        {exercise.type === 'quiz' ? (
          <QuizLayout statement={statement} hints={hints} actions={actions} history={history} />
        ) : (
          <SideBySideLayout
            statement={statement}
            hints={hints}
            actions={actions}
            history={history}
          />
        )}
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

type LayoutParts = {
  statement: ReactNode;
  /** Renders nothing when the exercise has no hints and no solution */
  hints: ReactNode;
  actions: ReactNode;
  history: ReactNode;
};

/** Code, project and self-check: statement on the left, "Làm bài" panel on the right. */
function SideBySideLayout({ statement, hints, actions, history }: LayoutParts) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
      {/* Statement, then hints and the reference solution (PRD F11) under it. */}
      <div className="motion-fade-up min-w-0 space-y-6" style={{ '--i': 1 } as CSSProperties}>
        {statement}
        {hints}
      </div>

      {/* Sticky on xl with its own scroll, so "Nộp bài" stays reachable beside a long
          statement. The small padding keeps focus outlines from being clipped. */}
      <div
        className="motion-fade-up space-y-6 xl:sticky xl:top-20 xl:-m-1 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto xl:overscroll-contain xl:p-1"
        style={{ '--i': 2 } as CSSProperties}
      >
        {actions}
        {history}
      </div>
    </div>
  );
}

/**
 * Quiz: one column of reading width, statement then questions. No inner scroll box, so
 * the page scrolls and the "Nộp bài" bar (sticky in QuizForm) stays at the bottom of
 * the screen.
 */
function QuizLayout({ statement, hints, actions, history }: LayoutParts) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="motion-fade-up space-y-6" style={{ '--i': 1 } as CSSProperties}>
        {statement}
        {hints}
      </div>
      <div className="motion-fade-up space-y-6" style={{ '--i': 2 } as CSSProperties}>
        {actions}
        {history}
      </div>
    </div>
  );
}
