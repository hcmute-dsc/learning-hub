import type { ReactNode } from 'react';
import type { TrackLevel } from '@hub/shared';
import { Breadcrumbs } from '@/components/learn/Breadcrumbs';
import { HexIcon } from '@/components/ui/HexIcon';
import { LEVEL_LABEL } from '@/lib/labels';
import { trackIconLabel } from '@/lib/track-icon';

/**
 * Top band of the track page: hexagon badge, title, summary, a few facts as chips and
 * the main call to action (passed in as `action`, so this component stays a pure layout).
 */
export function TrackHeader({
  title,
  summary,
  tags,
  level,
  estHours,
  lessonCount,
  exerciseCount,
  action,
}: {
  title: string;
  summary: string | null;
  tags: string[];
  level: TrackLevel | null;
  estHours: number | null;
  lessonCount: number;
  exerciseCount: number;
  action: ReactNode;
}) {
  return (
    <header>
      <Breadcrumbs items={[{ label: 'Lộ trình', href: '/tracks' }, { label: title }]} />

      {/* A soft orange wash instead of `.surface`, whose `background` shorthand would hide it. */}
      <div className="motion-fade-up relative mt-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] bg-gradient-to-br from-brand-500/10 via-transparent to-transparent p-5 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-7">
          <HexIcon label={trackIconLabel({ title, tags })} size={88} />

          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
            {summary && <p className="muted mt-2 max-w-2xl sm:text-lg">{summary}</p>}

            <ul aria-label="Thông tin lộ trình" className="mt-4 flex flex-wrap gap-2 text-sm">
              {level && <Chip icon="📶">{LEVEL_LABEL[level]}</Chip>}
              {estHours !== null && estHours > 0 && <Chip icon="⏱️">Khoảng {estHours} giờ</Chip>}
              <Chip icon="📖">{lessonCount} bài học</Chip>
              <Chip icon="🛠️">{exerciseCount} bài tập</Chip>
            </ul>

            <div className="mt-6">{action}</div>
          </div>
        </div>
      </div>
    </header>
  );
}

function Chip({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 py-1">
      <span aria-hidden>{icon}</span>
      {children}
    </li>
  );
}
