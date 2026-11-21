import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import type { NextItem } from '@hub/shared';
import { itemHref } from '@/components/learn/links';

type Count = { done: number; total: number };

/**
 * Three cards under the progress panel, as on Exercism's track page: lessons read,
 * exercises completed, and the next thing to open. The animation is on the <li> so the
 * `.lift` hover on the "next" link is not overridden by it.
 */
export function StatCards({
  lessons,
  exercises,
  next,
  enrolled,
}: {
  lessons: Count;
  exercises: Count;
  next: NextItem | null;
  enrolled: boolean;
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-3">
      <li className="motion-fade-up" style={{ '--i': 2 } as CSSProperties}>
        <CountCard icon="📖" label="Bài học đã học" count={lessons} />
      </li>
      <li className="motion-fade-up" style={{ '--i': 3 } as CSSProperties}>
        <CountCard icon="🛠️" label="Bài tập đã hoàn thành" count={exercises} />
      </li>
      <li className="motion-fade-up" style={{ '--i': 4 } as CSSProperties}>
        <NextCard next={next} enrolled={enrolled} />
      </li>
    </ul>
  );
}

function CardShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`surface h-full rounded-2xl p-5 ${className}`}>{children}</div>;
}

function CountCard({ icon, label, count }: { icon: string; label: string; count: Count }) {
  return (
    <CardShell>
      <p className="muted flex items-center gap-2 text-sm font-medium">
        <span aria-hidden>{icon}</span>
        {label}
      </p>
      <p className="mt-2 font-mono text-3xl font-bold tabular-nums">
        {count.done}
        <span className="muted text-lg font-medium">/{count.total}</span>
      </p>
    </CardShell>
  );
}

function NextCard({ next, enrolled }: { next: NextItem | null; enrolled: boolean }) {
  if (!next) {
    return (
      <CardShell>
        <p className="muted text-sm font-medium">Tiếp theo</p>
        <p className="mt-2 font-semibold">
          {enrolled ? 'Bạn đã làm hết mọi bài.' : 'Lộ trình này chưa có nội dung.'}
        </p>
      </CardShell>
    );
  }
  return (
    <Link
      href={itemHref(next)}
      // Not `.surface`: that class sets the `background` shorthand outside Tailwind's
      // layers, which would wipe out the gradient below.
      className="lift press group/card flex h-full flex-col rounded-2xl border border-brand-500/40 bg-[var(--surface)] bg-gradient-to-br from-brand-500/10 to-transparent p-5"
    >
      <span className="text-sm font-medium text-brand-600">
        {enrolled ? 'Tiếp theo' : 'Bắt đầu với'}
        <span className="sr-only"> ({next.kind === 'lesson' ? 'bài học' : 'bài tập'})</span>
      </span>
      <span className="mt-2 flex items-start justify-between gap-2 font-semibold leading-snug">
        {next.title}
        <span
          aria-hidden
          className="text-brand-600 transition-transform duration-200 group-hover/card:translate-x-1"
        >
          →
        </span>
      </span>
    </Link>
  );
}
