/**
 * Accessible progress bar: the percentage is also written as text next to it.
 * The fill grows in on first render (`.motion-grow-x` in globals.css).
 */
export function ProgressBar({
  percent,
  label,
  showValue = true,
}: {
  percent: number;
  label: string;
  /** hide the "42%" text when the caller already shows it */
  showValue?: boolean;
}) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="flex items-center gap-3">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--border)]"
      >
        <div
          className="motion-grow-x h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600"
          style={{ width: `${value}%` }}
        />
      </div>
      {showValue && <span className="font-mono text-sm tabular-nums">{value}%</span>}
    </div>
  );
}
