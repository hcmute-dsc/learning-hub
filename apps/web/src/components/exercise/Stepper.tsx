import type { CSSProperties, ReactNode } from 'react';

/**
 * Numbered steps joined by a vertical line, used by code and project exercises
 * ("1 Tạo repo → 2 Làm bài → 3 Nộp link"). An <ol> so screen readers announce
 * "1 of 3"; the visible number circle is decorative.
 */
export function Stepper({ children }: { children: ReactNode }) {
  return <ol className="space-y-6">{children}</ol>;
}

export function Step({
  number,
  title,
  last = false,
  children,
}: {
  number: number;
  title: string;
  /** The last step draws no line below its circle */
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <li className="motion-fade-up relative flex gap-4" style={{ '--i': number } as CSSProperties}>
      {!last && (
        <span
          aria-hidden
          className="absolute top-10 -bottom-5 left-4 w-0.5 -translate-x-1/2 rounded bg-[var(--border)]"
        />
      )}
      <span
        aria-hidden
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-600 font-mono text-sm font-bold text-white shadow-sm"
      >
        {number}
      </span>
      <div className="min-w-0 flex-1 pt-1 text-sm">
        <h3 className="font-semibold">
          <span className="sr-only">Bước {number}: </span>
          {title}
        </h3>
        <div className="mt-2">{children}</div>
      </div>
    </li>
  );
}
