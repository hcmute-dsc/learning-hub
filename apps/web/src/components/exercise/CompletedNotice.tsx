/**
 * Shown instead of the submit panel once a quiz, code or project exercise is completed.
 * The API answers any new attempt with 409 then (BACKEND-DESIGN §3.6: 409 = state
 * conflict), so a form would only lead to an error. Self-check keeps its own
 * read-only checklist instead.
 */
export function CompletedNotice() {
  return (
    <div className="rounded-xl border border-[var(--border)] p-4 text-sm">
      <p className="font-medium text-emerald-700 dark:text-emerald-300">
        <span aria-hidden>✓ </span>Bạn đã hoàn thành bài tập này.
      </p>
      <p className="muted mt-1">Xem lại các lần nộp trong lịch sử nộp bài.</p>
    </div>
  );
}
