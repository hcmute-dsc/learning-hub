import Link from 'next/link';
import type { TrackItemsProgress } from '@hub/shared';
import { HexIcon } from '@/components/ui/HexIcon';
import { EXERCISE_STATE_LABEL, LESSON_PROGRESS_LABEL } from '@/lib/labels';
import type { TrackDetail } from '@/lib/track';
import { trackIconLabel } from '@/lib/track-icon';
import { exerciseHref, lessonHref } from './links';
import { ProgressBar } from './ProgressBar';
import { countDone } from './track-progress';

/**
 * "Where am I in this track": every module with its lessons and exercises, the current
 * item highlighted and the current module open. Shown beside a lesson on wide screens
 * and in a collapsible box on phones (lessons/[id]/page.tsx).
 */
export function TrackSidebar({
  track,
  progress,
  currentId,
}: {
  track: TrackDetail;
  progress: TrackItemsProgress;
  currentId: string;
}) {
  const overall = countDone(track.modules, progress);

  return (
    <nav aria-label={`Mục lục: ${track.title}`} className="text-sm">
      <Link href={`/tracks/${track.slug}`} className="flex items-center gap-3 hover:underline">
        <HexIcon label={trackIconLabel(track)} size={40} />
        <span className="font-semibold leading-tight">{track.title}</span>
      </Link>
      <div className="mt-3">
        <ProgressBar percent={overall.percent} label={`Tiến độ ${track.title}`} />
        <p className="muted mt-1 text-xs">
          {overall.done}/{overall.total} mục đã xong
        </p>
      </div>

      <ol className="mt-4 space-y-1">
        {track.modules.map((m) => {
          const isCurrent =
            m.lessons.some((l) => l.id === currentId) ||
            m.exercises.some((x) => x.id === currentId);
          const mod = countDone([m], progress);
          return (
            <li key={m.id}>
              <details open={isCurrent}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-md px-2 py-1.5 font-medium hover:bg-[var(--code-bg)]">
                  <span className="min-w-0">{m.title}</span>
                  <span className="muted shrink-0 font-mono text-xs tabular-nums">
                    {mod.done}/{mod.total}
                  </span>
                </summary>
                <ul className="mb-2 ml-2 border-l border-[var(--border)] pl-2">
                  {m.lessons.map((l) => (
                    <SidebarItem
                      key={l.id}
                      href={lessonHref(l.id)}
                      title={l.title}
                      status={LESSON_PROGRESS_LABEL[progress.lessons[l.id] ?? 'not_started']}
                      done={progress.lessons[l.id] === 'completed'}
                      current={l.id === currentId}
                    />
                  ))}
                  {m.exercises.map((x) => (
                    <SidebarItem
                      key={x.id}
                      href={exerciseHref(x.id)}
                      title={x.title}
                      status={EXERCISE_STATE_LABEL[progress.exercises[x.id] ?? 'not_started']}
                      done={progress.exercises[x.id] === 'completed'}
                      current={x.id === currentId}
                      exercise
                    />
                  ))}
                </ul>
              </details>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function SidebarItem({
  href,
  title,
  status,
  done,
  current,
  exercise = false,
}: {
  href: string;
  title: string;
  status: { text: string; icon: string };
  done: boolean;
  current: boolean;
  exercise?: boolean;
}) {
  return (
    <li>
      <Link
        prefetch={false}
        href={href}
        aria-current={current ? 'page' : undefined}
        className={`flex items-start gap-2 rounded-md px-2 py-1 leading-snug ${
          current ? 'bg-brand-50 font-semibold text-brand-700' : 'hover:bg-[var(--code-bg)]'
        }`}
      >
        <span
          aria-hidden
          className={`mt-px w-4 shrink-0 text-center ${done ? 'text-emerald-600 dark:text-emerald-400' : 'muted'}`}
        >
          {status.icon}
        </span>
        <span className="min-w-0">
          {exercise && <span className="sr-only">Bài tập: </span>}
          {title}
          <span className="sr-only"> ({status.text})</span>
        </span>
      </Link>
    </li>
  );
}
