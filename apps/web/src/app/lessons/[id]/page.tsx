import type { Metadata } from 'next';
import type { LessonView } from '@hub/shared';
import { Breadcrumbs } from '@/components/learn/Breadcrumbs';
import { LessonNav } from '@/components/learn/LessonNav';
import { LessonStatusBadge } from '@/components/learn/LessonStatusBadge';
import { moduleHref } from '@/components/learn/links';
import { MarkLessonDone } from '@/components/learn/MarkLessonDone';
import { RelatedExercises } from '@/components/learn/RelatedExercises';
import { githubBlobUrl } from '@/components/markdown/content-url';
import { Markdown } from '@/components/markdown/Markdown';
import { apiOrNotFound } from '@/lib/api';

type Params = { params: Promise<{ id: string }> };

async function loadLesson(id: string): Promise<LessonView> {
  return (await apiOrNotFound<{ data: LessonView }>(`/lessons/${encodeURIComponent(id)}`)).data;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const lesson = await loadLesson(id);
  return { title: lesson.title };
}

/** Lesson page (INFORMATION-ARCHITECTURE §5): read, mark as done, go on. */
export default async function LessonPage({ params }: Params) {
  const { id } = await params;
  const lesson = await loadLesson(id);
  const editUrl = githubBlobUrl(lesson.source);

  return (
    <article className="space-y-8">
      <header>
        <Breadcrumbs
          items={[
            { label: 'Lộ trình', href: '/tracks' },
            { label: lesson.track.title, href: `/tracks/${lesson.track.slug}` },
            { label: lesson.module.title, href: moduleHref(lesson.track.slug, lesson.module.slug) },
          ]}
        />
        <h1 className="mt-2 text-3xl font-bold">{lesson.title}</h1>
        <p className="muted mt-2 flex flex-wrap items-center gap-3 text-sm">
          <LessonStatusBadge status={lesson.progress} />
          {lesson.estMinutes && <span>{lesson.estMinutes} phút đọc</span>}
          {editUrl && (
            <a href={editUrl} rel="noopener noreferrer" className="underline">
              Sửa trên GitHub
            </a>
          )}
        </p>
      </header>

      <Markdown source={lesson.bodyMd} origin={lesson.source} />

      <MarkLessonDone lessonId={lesson.id} status={lesson.progress} />
      <RelatedExercises exercises={lesson.exercises} />
      <LessonNav previous={lesson.previous} next={lesson.next} />
    </article>
  );
}
