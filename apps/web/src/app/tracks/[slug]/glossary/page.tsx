import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/learn/Breadcrumbs';
import { githubBlobUrl } from '@/components/markdown/content-url';
import { GlossaryList } from '@/components/track/GlossaryList';
import { TrackTabs } from '@/components/track/TrackTabs';
import { GLOSSARY_LABEL, trackTabs } from '@/components/track/track-docs';
import { canSeeTrackStats, loadTrack, loadTrackGlossary } from '@/lib/track';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const track = await loadTrack(slug);
  return { title: `${GLOSSARY_LABEL} · ${track.title}` };
}

/**
 * "Từ vựng" (/tracks/:slug/glossary, learning-hub#106): the English words of the track from
 * its glossary.yaml (CONTENT-SPECIFICATION §3.1c), A–Z with a search box. Each term has an
 * anchor (#init) that lessons link to, and "Học ở bài …" links back to the lessons.
 */
export default async function TrackGlossaryPage({ params }: Params) {
  const { slug } = await params;
  const [track, glossary, canSeeStats] = await Promise.all([
    loadTrack(slug),
    loadTrackGlossary(slug),
    canSeeTrackStats(slug),
  ]);
  const editUrl = githubBlobUrl(glossary.source);

  return (
    <article className="space-y-6 sm:space-y-8">
      <header>
        <Breadcrumbs
          items={[
            { label: 'Lộ trình', href: '/tracks' },
            { label: track.title, href: `/tracks/${track.slug}` },
            { label: GLOSSARY_LABEL },
          ]}
        />
        <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">{GLOSSARY_LABEL}</h1>
        <p className="muted mt-2 max-w-2xl">
          Chữ tiếng Anh của lộ trình này: viết đầy đủ là gì, nghĩa đen là gì, và dùng để làm gì.
          Hiểu chữ thì nhớ lệnh lâu hơn.
        </p>
        {editUrl && (
          <p className="muted mt-3 text-sm">
            <a href={editUrl} rel="noopener noreferrer" className="hover:underline">
              ✎ Sửa trên GitHub
            </a>
          </p>
        )}
      </header>

      <TrackTabs tabs={trackTabs(track.slug, { ...track, canSeeStats }, 'glossary')} />

      <div className="max-w-[60rem]">
        <GlossaryList terms={glossary.terms} />
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
