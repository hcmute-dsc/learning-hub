/** Grey placeholder lines while a page loads (FRONTEND-DESIGN §8). */
export function PageSkeleton({ label, lines = 5 }: { label: string; lines?: number }) {
  const rows: number[] = [];
  for (let i = 0; i < lines; i++) rows.push(i);
  return (
    <div role="status" aria-label={label} className="animate-pulse space-y-3">
      <div className="h-4 w-48 rounded bg-[var(--border)]" />
      <div className="h-8 w-2/3 rounded bg-[var(--border)]" />
      {rows.map((i) => (
        <div key={i} className="h-4 max-w-[72ch] rounded bg-[var(--border)]" />
      ))}
    </div>
  );
}
