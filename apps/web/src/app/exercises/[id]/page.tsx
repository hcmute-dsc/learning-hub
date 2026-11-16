import type { Metadata } from 'next';
import type { ExerciseView, SubmissionView } from '@hub/shared';
import { AttemptHistory } from '@/components/exercise/AttemptHistory';
import { ExerciseActions } from '@/components/exercise/ExerciseActions';
import { ExerciseHeader } from '@/components/exercise/ExerciseHeader';
import { Markdown } from '@/components/markdown/Markdown';
import { apiOrNotFound } from '@/lib/api';

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
 * Exercise page (INFORMATION-ARCHITECTURE §6): statement on the left, the action panel
 * for its type on the right (one column on phones), attempt history below.
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

  return (
    <article className="space-y-8">
      <ExerciseHeader exercise={exercise} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <section aria-labelledby="statement-title">
          <h2 id="statement-title" className="sr-only">
            Đề bài
          </h2>
          {/* The API sends no source path for statements yet, so relative links stay as written. */}
          <Markdown source={exercise.statementMd} />
        </section>

        <section aria-labelledby="actions-title" className="surface h-fit rounded-xl p-5">
          <h2 id="actions-title" className="mb-4 font-semibold">
            Làm bài
          </h2>
          <ExerciseActions exercise={exercise} />
        </section>
      </div>

      <AttemptHistory submissions={submissions} />
    </article>
  );
}
