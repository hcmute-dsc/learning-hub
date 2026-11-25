import type { Metadata } from 'next';
import type { LessonView } from '@hub/shared';
import { ReportContentButton } from '@/components/content-report/ReportContentButton';
import { Breadcrumbs } from '@/components/learn/Breadcrumbs';
import { LessonNav } from '@/components/learn/LessonNav';
import { LessonStatusBadge } from '@/components/learn/LessonStatusBadge';
import { moduleHref } from '@/components/learn/links';
import { MarkLessonDone } from '@/components/learn/MarkLessonDone';
import { NewWords } from '@/components/learn/NewWords';
import { RelatedExercises } from '@/components/learn/RelatedExercises';
import { TrackSidebar } from '@/components/learn/TrackSidebar';
import { editOnGitHubUrl } from '@/components/markdown/content-url';
import { Markdown } from '@/components/markdown/Markdown';
import { apiOrNotFound, getMe } from '@/lib/api';
import { loadTrack, loadTrackProgress } from '@/lib/track';

type Params = { params: Promise<{ id: string }> };

async function loadLesson(id: string): Promise<LessonView> {
  return (await apiOrNotFound<{ data: LessonView }>(`/lessons/${encodeURIComponent(id)}`)).data;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const lesson = await loadLesson(id);
  return { title: lesson.title };
}

/**
 * Lesson page (INFORMATION-ARCHITECTURE §5). Wide screens: track outline on the left,
 * the lesson in a readable column. Phones: the outline folds into a box above the text.
 */
export default async function LessonPage({ params }: Params) {
  const { id } = await params;
  const lesson = await loadLesson(id);
  const [track, progress, me] = await Promise.all([
    loadTrack(lesson.track.slug),
    loadTrackProgress(lesson.track.slug),
    getMe(),
  ]);
  const editUrl = editOnGitHubUrl(lesson.source, me?.roles);
  const sidebar = <TrackSidebar track={track} progress={progress} currentId={lesson.id} />;

  return (
    // Wide page, but the reading column stops at 60rem so lines stay readable; the
    // outline + text pair is centred (see `.page-wide` in globals.css).
    <div className="page-wide lg:grid lg:grid-cols-[17rem_minmax(0,60rem)] lg:justify-center lg:gap-10">
      <aside className="hidden lg:block">
        <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2 pb-6">
          {sidebar}
        </div>
      </aside>

      <article className="motion-fade-up min-w-0 space-y-8">
        <header>
          <Breadcrumbs
            items={[
              { label: 'Lộ trình', href: '/tracks' },
              { label: lesson.track.title, href: `/tracks/${lesson.track.slug}` },
              {
                label: lesson.module.title,
                href: moduleHref(lesson.track.slug, lesson.module.slug),
              },
            ]}
          />
          <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">{lesson.title}</h1>
          <p className="muted mt-3 flex flex-wrap items-center gap-3 text-sm">
            <LessonStatusBadge status={lesson.progress} />
            {lesson.estMinutes && <span>⏱ {lesson.estMinutes} phút đọc</span>}
            {editUrl && (
              <a href={editUrl} rel="noopener noreferrer" className="hover:underline">
                ✎ Sửa trên GitHub
              </a>
            )}
            <ReportContentButton target={{ kind: 'lesson', id: lesson.id }} />
          </p>
          <details className="surface mt-5 rounded-xl p-4 lg:hidden">
            <summary className="cursor-pointer font-medium">Mục lục lộ trình</summary>
            <div className="mt-3">{sidebar}</div>
          </details>
        </header>

        <Markdown
          source={lesson.bodyMd}
          origin={lesson.source}
          glossary={{ trackSlug: lesson.track.slug, terms: lesson.terms ?? [] }}
        />

        <NewWords trackSlug={lesson.track.slug} terms={lesson.terms ?? []} />

        <section className="surface space-y-5 rounded-xl p-5">
          <MarkLessonDone lessonId={lesson.id} status={lesson.progress} />
          <RelatedExercises exercises={lesson.exercises} />
        </section>
        <LessonNav previous={lesson.previous} next={lesson.next} />
      </article>
    </div>
  );
}
