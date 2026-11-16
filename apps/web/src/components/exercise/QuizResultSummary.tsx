import type { QuizResult } from '@hub/shared';
import { formatPercent } from '@/lib/format';

const PASSED_TONE =
  'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100';
const FAILED_TONE =
  'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100';

/** Score of one quiz attempt; pass/fail is said in words, not only by color. */
export function QuizResultSummary({
  result,
  passScore,
}: {
  result: QuizResult;
  passScore: number;
}) {
  const correct = result.questions.filter((q) => q.correct).length;
  return (
    <div className={`rounded-xl border p-4 ${result.passed ? PASSED_TONE : FAILED_TONE}`}>
      <p className="font-semibold">
        {result.passed ? '✓ Đạt' : '✗ Chưa đạt'}: {formatPercent(result.score)} ({correct}/
        {result.questions.length} câu đúng), lần làm thứ {result.attempt}
      </p>
      <p className="mt-1 text-sm">
        {result.passed
          ? 'Bài tập đã hoàn thành. Bạn có thể xem lại giải thích từng câu bên trên.'
          : `Cần ${formatPercent(passScore)} để đạt. Đọc giải thích từng câu rồi bấm “Làm lại”.`}
      </p>
    </div>
  );
}
