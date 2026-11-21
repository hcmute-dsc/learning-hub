import Link from 'next/link';
import type { ItemTone } from './track-items';
import { TONE_DOT_CLASS, ToneIcon } from './tone';

/**
 * One lesson or exercise inside a module card. The whole row is a link (bigger tap
 * target on phones); the status is written as text, the colored dot only repeats it.
 */
export function ItemRow({
  kind,
  href,
  title,
  tone,
  statusText,
  meta,
  chip,
}: {
  kind: 'lesson' | 'exercise';
  href: string;
  title: string;
  tone: ItemTone;
  /** null hides the status (e.g. lessons before enrolling) */
  statusText: string | null;
  /** short muted fact on the right, e.g. "15 phút" or "Dễ" */
  meta: string | null;
  /** exercise type, e.g. "Code" or "Quiz" */
  chip?: string;
}) {
  return (
    <li>
      <Link
        prefetch={false}
        href={href}
        className="lift group/row flex items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2.5 sm:px-4"
      >
        <span
          aria-hidden
          className={`grid h-6 w-6 shrink-0 place-items-center border-2 ${
            kind === 'lesson' ? 'rounded-full' : 'rounded-md'
          } ${TONE_DOT_CLASS[tone]}`}
        >
          <ToneIcon tone={tone} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block font-medium leading-snug group-hover/row:text-brand-600">
            <span className="sr-only">{kind === 'lesson' ? 'Bài học' : 'Bài tập'}: </span>
            {title}
          </span>
          {statusText && (
            <span className="muted block text-xs">
              <span className="sr-only">Trạng thái: </span>
              {statusText}
            </span>
          )}
        </span>

        <span className="flex shrink-0 items-center gap-2 text-xs">
          {meta && <span className="muted hidden sm:inline">{meta}</span>}
          {chip && (
            <span className="rounded-full bg-brand-500/15 px-2 py-0.5 font-medium text-brand-700">
              {chip}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}
