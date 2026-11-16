import type { QuizResult } from '@hub/shared';
import { formatPercent } from '@/lib/format';
import { CheckIcon } from './CheckIcon';
import { TONE_CLASS } from './exercise-status';
import { countCorrect } from './quiz-answers';

/**
 * Score of one quiz attempt: the percent, a bar that grows to it with a mark at the
 * pass score, and pass/fail in words (not only by color).
 */
export function QuizResultSummary({
  result,
  passScore,
}: {
  result: QuizResult;
  passScore: number;
}) {
  const correct = countCorrect(result);
  const scorePercent = Math.round(result.score * 100);
  const passPercent = Math.round(passScore * 100);

  return (
    <div
      className={`motion-fade-up rounded-xl border p-4 ${TONE_CLASS[result.passed ? 'success' : 'warning']}`}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={`motion-pop grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg font-bold text-white ${
            result.passed ? 'bg-emerald-600' : 'bg-orange-600'
          }`}
        >
          {result.passed ? <CheckIcon className="h-5 w-5" /> : '↻'}
        </span>
        <div className="min-w-0">
          <p className="font-semibold">
            {result.passed ? 'Đạt' : 'Chưa đạt'}: {formatPercent(result.score)}
          </p>
          <p className="text-sm">
            {correct}/{result.questions.length} câu đúng · lần làm thứ {result.attempt}
          </p>
        </div>
      </div>

      <div
        role="img"
        aria-label={`Điểm ${scorePercent}%, cần ${passPercent}% để đạt`}
        className="relative mt-4 h-2.5 rounded-full bg-black/10 dark:bg-white/15"
      >
        <div
          className={`motion-grow-x h-full rounded-full ${result.passed ? 'bg-emerald-600' : 'bg-orange-600'}`}
          style={{ width: `${scorePercent}%` }}
        />
        <span
          aria-hidden
          title={`Mức đạt: ${passPercent}%`}
          className="absolute -top-1 -bottom-1 w-0.5 rounded bg-current"
          style={{ left: `${passPercent}%` }}
        />
      </div>

      <p className="mt-3 text-sm">
        {result.passed
          ? 'Bài tập đã hoàn thành. Bạn có thể xem lại giải thích từng câu.'
          : `Cần ${formatPercent(passScore)} để đạt. Đọc giải thích từng câu rồi bấm “Làm lại”.`}
      </p>
    </div>
  );
}
