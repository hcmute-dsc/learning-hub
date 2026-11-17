import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import type { ExerciseView, SubmissionView } from '@hub/shared';
import { AttemptHistory } from '@/components/exercise/AttemptHistory';
import { ExerciseActions } from '@/components/exercise/ExerciseActions';
import { ExerciseHeader } from '@/components/exercise/ExerciseHeader';
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

  return (
    <div className="lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-10">
      <aside className="hidden lg:block">
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

        <details className="surface rounded-xl p-4 lg:hidden">
          <summary className="cursor-pointer font-medium">Mục lục lộ trình</summary>
          <div className="mt-3">{sidebar}</div>
        </details>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] xl:items-start">
          <section
            aria-labelledby="statement-title"
            className="surface motion-fade-up min-w-0 rounded-2xl p-5 sm:p-7"
            style={{ '--i': 1 } as CSSProperties}
          >
            <PanelTitle id="statement-title" icon="📄">
              Đề bài
            </PanelTitle>
            {/* The API sends no source path for statements yet, so relative links stay as written. */}
            <Markdown source={exercise.statementMd} />
          </section>

          {/* Sticky on xl with its own scroll, so "Nộp bài" stays reachable beside a long
              statement. The small padding keeps focus outlines from being clipped. */}
          <div
            className="motion-fade-up space-y-6 xl:sticky xl:top-20 xl:-m-1 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto xl:overscroll-contain xl:p-1"
            style={{ '--i': 2 } as CSSProperties}
          >
            <section aria-labelledby="actions-title" className="surface rounded-2xl p-5">
              {/* Accent bar as an element: `.surface` sets the whole border, so a
                  border-t utility would lose to it. */}
              <div aria-hidden className="-mx-5 -mt-5 mb-5 h-1 rounded-t-2xl bg-brand-500" />
              <PanelTitle id="actions-title" icon="✍️">
                Làm bài
              </PanelTitle>
              <ExerciseActions exercise={exercise} />
            </section>
            <AttemptHistory submissions={submissions} />
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
