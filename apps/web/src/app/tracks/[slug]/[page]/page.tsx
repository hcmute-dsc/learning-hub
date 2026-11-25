import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ReportContentButton } from '@/components/content-report/ReportContentButton';
import { Breadcrumbs } from '@/components/learn/Breadcrumbs';
import { editOnGitHubUrl } from '@/components/markdown/content-url';
import { getMe } from '@/lib/api';
import { Markdown } from '@/components/markdown/Markdown';
import { TrackTabs } from '@/components/track/TrackTabs';
import {
  isTrackDocPage,
  TRACK_DOC_INTRO,
  TRACK_DOC_LABEL,
  trackTabs,
} from '@/components/track/track-docs';
import { canSeeTrackStats, loadTrack, loadTrackDoc } from '@/lib/track';

type Params = { params: Promise<{ slug: string; page: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, page } = await params;
  if (!isTrackDocPage(page)) notFound();
  const track = await loadTrack(slug);
  return { title: `${TRACK_DOC_LABEL[page]} · ${track.title}` };
}

/**
 * "Cài đặt" (/tracks/:slug/setup) and "Tài liệu thêm" (/tracks/:slug/resources): the track's
 * optional docs/setup.md and docs/resources.md (CONTENT-SPECIFICATION §3.1b, learning-hub#44).
 * Rendered with the lesson renderer, so the same sanitizing applies (SECURITY §3).
 */
export default async function TrackDocPage({ params }: Params) {
  const { slug, page } = await params;
  if (!isTrackDocPage(page)) notFound();
  const [track, doc, canSeeStats, me] = await Promise.all([
    loadTrack(slug),
    loadTrackDoc(slug, page),
    canSeeTrackStats(),
    getMe(),
  ]);
  const editUrl = editOnGitHubUrl(doc.source, me?.roles);

  return (
    <article className="space-y-6 sm:space-y-8">
      <header>
        <Breadcrumbs
          items={[
            { label: 'Lộ trình', href: '/tracks' },
            { label: track.title, href: `/tracks/${track.slug}` },
            { label: TRACK_DOC_LABEL[page] },
          ]}
        />
        <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">
          {TRACK_DOC_LABEL[page]}
        </h1>
        <p className="muted mt-2 max-w-2xl">{TRACK_DOC_INTRO[page]}</p>
        <p className="muted mt-3 flex flex-wrap gap-4 text-sm">
          {editUrl && (
            <a href={editUrl} rel="noopener noreferrer" className="hover:underline">
              ✎ Sửa trên GitHub
            </a>
          )}
          <ReportContentButton target={{ kind: 'track_page', track: track.slug, page }} />
        </p>
      </header>

      <TrackTabs tabs={trackTabs(track.slug, { ...track, canSeeStats }, page)} />

      <div className="max-w-[60rem]">
        <Markdown source={doc.bodyMd} origin={doc.source} />
      </div>

      <Link
        href={`/tracks/${track.slug}`}
        className="inline-block text-sm font-medium text-brand-600 hover:underline"
      >
        ← Về lộ trình {track.title}
      </Link>
    </article>
  );
}
