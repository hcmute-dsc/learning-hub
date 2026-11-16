import type { ItemTone } from './track-items';

/**
 * How each tone looks. Every tone has its own SHAPE as well as a color (check mark,
 * half-filled, empty outline, dashed + lock) so the dot grid still reads for people who
 * cannot tell the colors apart (FRONTEND-DESIGN §9, WCAG 1.4.1).
 */
export const TONE_LABEL: Record<ItemTone, string> = {
  done: 'Hoàn thành',
  active: 'Đang làm',
  todo: 'Chưa bắt đầu',
  locked: 'Đang khóa',
};

/** Border + fill of a dot. Borders on the empty tones use slate-500/400 for 3:1 contrast. */
export const TONE_DOT_CLASS: Record<ItemTone, string> = {
  done: 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-emerald-950',
  active: 'border-brand-500 bg-brand-500/15 text-brand-600',
  todo: 'border-slate-500 dark:border-slate-400',
  locked: 'border-dashed border-slate-500 text-slate-500 dark:border-slate-400 dark:text-slate-400',
};

/** Small icon drawn inside a dot (or next to a row). Decorative: the text label is elsewhere. */
export function ToneIcon({ tone, className = 'h-3 w-3' }: { tone: ItemTone; className?: string }) {
  if (tone === 'todo') return null;
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {tone === 'done' && <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />}
      {/* Half-filled circle = "started, not finished". */}
      {tone === 'active' && <path d="M8 3a5 5 0 0 1 0 10Z" fill="currentColor" stroke="none" />}
      {tone === 'locked' && (
        <>
          <rect x="4" y="7.5" width="8" height="6" rx="1.2" />
          <path d="M5.8 7.5V5.5a2.2 2.2 0 0 1 4.4 0v2" />
        </>
      )}
    </svg>
  );
}
