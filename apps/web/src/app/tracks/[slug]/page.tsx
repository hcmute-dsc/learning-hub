import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ExerciseType } from '@hub/shared';
import { api, ApiError } from '@/lib/api';

interface TrackDetail {
  slug: string;
  title: string;
  summary: string | null;
  estHours: number | null;
  tags: string[];
  source: { repo: string; commitSha: string; path: string };
  modules: {
    id: string;
    title: string;
    summary: string | null;
    lessons: { id: string; title: string; estMinutes: number | null }[];
    exercises: { id: string; title: string; type: ExerciseType; difficulty: string }[];
  }[];
}

const TYPE_LABEL: Record<ExerciseType, string> = {
  code: 'Code',
  quiz: 'Quiz',
  project: 'Dự án',
  self_check: 'Tự kiểm tra',
};

export default async function TrackPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let track: TrackDetail;
  try {
    track = (await api<{ data: TrackDetail }>(`/tracks/${encodeURIComponent(slug)}`)).data;
  } catch (e) {
    if (e instanceof ApiError && (e.problem.status === 404 || e.problem.status === 422)) notFound();
    throw e;
  }

  return (
    <article>
      <nav aria-label="Breadcrumb" className="muted text-sm">
        <Link href="/tracks" className="hover:underline">
          Lộ trình
        </Link>{' '}
        › {track.title}
      </nav>
      <h1 className="mt-2 text-3xl font-bold">{track.title}</h1>
      {track.summary && <p className="muted mt-2 max-w-2xl">{track.summary}</p>}

      <ol className="mt-8 space-y-4">
        {track.modules.map((m, i) => (
          <li key={m.id} className="surface rounded-xl p-5">
            <h2 className="font-semibold">
              <span className="muted font-mono">{String(i + 1).padStart(2, '0')}</span> {m.title}
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm">
              {m.lessons.map((l) => (
                <li key={l.id} className="flex justify-between gap-2">
                  <span>📖 {l.title}</span>
                  {l.estMinutes && <span className="muted">{l.estMinutes} phút</span>}
                </li>
              ))}
              {m.exercises.map((x) => (
                <li key={x.id} className="flex justify-between gap-2">
                  <span>🛠️ {x.title}</span>
                  <span className="muted">{TYPE_LABEL[x.type]}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <p className="muted mt-8 text-xs">
        Nguồn: {track.source.repo} @ <code>{track.source.commitSha.slice(0, 7)}</code>
      </p>
    </article>
  );
}
