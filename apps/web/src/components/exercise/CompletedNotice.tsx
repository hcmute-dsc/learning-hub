import { CheckIcon } from './CheckIcon';

/**
 * Shown instead of the submit panel once a quiz, code or project exercise is completed.
 * The API answers any new attempt with 409 then (BACKEND-DESIGN §3.6: 409 = state
 * conflict), so a form would only lead to an error. Self-check keeps its own
 * read-only checklist instead.
 */
export function CompletedNotice() {
  return (
    <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-6 text-center text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100">
      <span
        aria-hidden
        className="motion-pop mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-600 text-white shadow"
      >
        <CheckIcon className="h-6 w-6" />
      </span>
      <p className="mt-3 font-semibold">Bạn đã hoàn thành bài tập này.</p>
      <p className="mt-1">Xem lại các lần nộp trong lịch sử nộp bài.</p>
    </div>
  );
}
