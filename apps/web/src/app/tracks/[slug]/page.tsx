import type { Metadata } from 'next';
import type { TrackItemsProgress } from '@hub/shared';
import { Breadcrumbs } from '@/components/learn/Breadcrumbs';
import { EnrollButton } from '@/components/learn/EnrollButton';
import { ModuleOutline, type ModuleOutlineData } from '@/components/learn/ModuleOutline';
import { apiOrNotFound } from '@/lib/api';

/** GET /tracks/:slug (catalog module; not in @hub/shared yet). */
interface TrackDetail {
  slug: string;
  title: string;
  summary: string | null;
  estHours: number | null;
  tags: string[];
  source: { repo: string; commitSha: string; path: string };
  modules: ModuleOutlineData[];
}

type Params = { params: Promise<{ slug: string }> };

async function loadTrack(slug: string): Promise<TrackDetail> {
  return (await apiOrNotFound<{ data: TrackDetail }>(`/tracks/${encodeURIComponent(slug)}`)).data;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const track = await loadTrack(slug);
  return { title: track.title };
}

export default async function TrackPage({ params }: Params) {
  const { slug } = await params;
  // Both calls map a bad slug (422) or an archived track (404) to notFound().
  const [track, progress] = await Promise.all([
    loadTrack(slug),
    apiOrNotFound<{ data: TrackItemsProgress }>(
      `/tracks/${encodeURIComponent(slug)}/progress`,
    ).then((r) => r.data),
  ]);

  return (
    <article>
      <Breadcrumbs items={[{ label: 'Lộ trình', href: '/tracks' }, { label: track.title }]} />
      <h1 className="mt-2 text-3xl font-bold">{track.title}</h1>
      {track.summary && <p className="muted mt-2 max-w-2xl">{track.summary}</p>}
      {track.estHours && <p className="muted mt-1 text-sm">Khoảng {track.estHours} giờ</p>}

      <div className="mt-5">
        <EnrollButton
          slug={track.slug}
          enrolled={progress.enrolled}
          completed={progress.completed}
          next={progress.next}
        />
      </div>

      <ol className="mt-8 space-y-4">
        {track.modules.map((m, i) => (
          <li key={m.id}>
            <ModuleOutline
              module={m}
              index={i}
              // Before enrolling every lesson is "not started"; badges would only add noise.
              lessonStatus={progress.enrolled ? progress.lessons : undefined}
              exerciseState={progress.exercises}
            />
          </li>
        ))}
      </ol>

      <p className="muted mt-8 text-xs">
        Nguồn: {track.source.repo} @ <code>{track.source.commitSha.slice(0, 7)}</code>
      </p>
    </article>
  );
}
