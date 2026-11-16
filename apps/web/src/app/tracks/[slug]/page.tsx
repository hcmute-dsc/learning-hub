import type { Metadata } from 'next';
import { EnrollButton } from '@/components/learn/EnrollButton';
import { ModuleOutline } from '@/components/learn/ModuleOutline';
import { countDone } from '@/components/learn/track-progress';
import { ProgressPanel } from '@/components/track/ProgressPanel';
import { StatCards } from '@/components/track/StatCards';
import { TrackHeader } from '@/components/track/TrackHeader';
import { countByKind, listTrackItems } from '@/components/track/track-items';
import { loadTrack, loadTrackProgress } from '@/lib/track';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const track = await loadTrack(slug);
  return { title: track.title, description: track.summary ?? undefined };
}

/** Track overview, in the spirit of Exercism's track page (e.g. exercism.org/tracks/go). */
export default async function TrackPage({ params }: Params) {
  const { slug } = await params;
  // Load the track first: a bad slug (422) or an archived track (404) becomes notFound()
  // there. loadTrackProgress has no such mapping, so it must not fail first.
  const track = await loadTrack(slug);
  const progress = await loadTrackProgress(slug);

  const items = listTrackItems(track.modules, progress);
  const byKind = countByKind(items);
  const overall = countDone(track.modules, progress);

  return (
    <article className="space-y-6 sm:space-y-8">
      <TrackHeader
        title={track.title}
        summary={track.summary}
        tags={track.tags}
        level={track.level}
        estHours={track.estHours}
        lessonCount={byKind.lessons.total}
        exerciseCount={byKind.exercises.total}
        action={
          <EnrollButton
            slug={track.slug}
            enrolled={progress.enrolled}
            completed={progress.completed}
            next={progress.next}
          />
        }
      />

      <ProgressPanel items={items} percent={overall.percent} enrolled={progress.enrolled} />

      {items.length > 0 && (
        <StatCards
          lessons={byKind.lessons}
          exercises={byKind.exercises}
          next={progress.next}
          enrolled={progress.enrolled}
        />
      )}

      <section aria-labelledby="track-modules-title">
        <h2 id="track-modules-title" className="text-xl font-bold sm:text-2xl">
          Nội dung lộ trình
          <span className="muted ml-2 text-base font-normal">{track.modules.length} chương</span>
        </h2>
        {track.modules.length === 0 ? (
          <p className="muted mt-3">Lộ trình này chưa có chương nào.</p>
        ) : (
          <ol className="mt-4 space-y-4">
            {track.modules.map((m, i) => (
              <li key={m.id}>
                <ModuleOutline
                  module={m}
                  index={i}
                  progress={progress}
                  enrolled={progress.enrolled}
                />
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="muted text-xs">
        Nguồn: {track.source.repo} @ <code>{track.source.commitSha.slice(0, 7)}</code>
      </p>
    </article>
  );
}
