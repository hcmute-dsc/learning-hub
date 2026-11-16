/** Accessible progress bar: the percentage is also written as text next to it. */
export function ProgressBar({ percent, label }: { percent: number; label: string }) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="flex items-center gap-3">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--border)]"
      >
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${value}%` }} />
      </div>
      <span className="font-mono text-sm tabular-nums">{value}%</span>
    </div>
  );
}
