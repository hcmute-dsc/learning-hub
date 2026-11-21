import type { ExerciseView } from '@hub/shared';
import { Markdown } from '@/components/markdown/Markdown';
import { nextHintStatus } from './hints';
import { OpenHintButton } from './OpenHintButton';

/**
 * Progressive hints and the reference solution (PRD F11), under the statement. The API only
 * sends the text of hints the member opened, and the solution once the exercise is completed, so
 * nothing here can reveal more than the member may see.
 */
export function HintsPanel({ exercise }: { exercise: ExerciseView }) {
  const { hints, solution } = exercise;
  if (hints.total === 0 && !solution) return null;
  const status = nextHintStatus(hints, exercise);
  const title = hints.total === 0 ? 'Lời giải tham khảo' : solution ? 'Gợi ý và lời giải' : 'Gợi ý';

  return (
    <section aria-labelledby="hints-title" className="surface rounded-2xl p-5 sm:p-7">
      <h2 id="hints-title" className="mb-1 flex items-center gap-2 text-lg font-semibold">
        <span aria-hidden>💡</span>
        {title}
      </h2>

      {hints.total > 0 && (
        <>
          <p className="muted text-sm">
            Mở từng gợi ý khi bị kẹt. Mở gợi ý không trừ điểm. Đã mở {hints.opened.length}/
            {hints.total}.
          </p>
          <ol className="mt-4 space-y-3">
            {hints.opened.map((hint) => (
              <li
                key={hint.position}
                className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950"
              >
                <p className="mb-2 text-sm font-semibold">Gợi ý {hint.position}</p>
                <Markdown source={hint.bodyMd} />
              </li>
            ))}
          </ol>
          <div className="mt-4" aria-live="polite">
            {status.kind === 'ready' && (
              <OpenHintButton
                exerciseId={exercise.id}
                position={status.position}
                label={status.label}
              />
            )}
            {status.kind === 'waiting' && <p className="muted text-sm">🔒 {status.reason}</p>}
          </div>
        </>
      )}

      {solution && (
        <div className={hints.total > 0 ? 'mt-6 border-t border-[var(--border)] pt-5' : 'mt-3'}>
          {solution.bodyMd !== null ? (
            <details>
              <summary className="cursor-pointer font-semibold">
                <span aria-hidden>✅ </span>
                Xem lời giải tham khảo
              </summary>
              <div className="mt-3">
                <Markdown source={solution.bodyMd} />
              </div>
            </details>
          ) : (
            <p className="muted text-sm">
              <span aria-hidden>🔒 </span>
              Lời giải tham khảo mở khi bạn hoàn thành bài (bài đạt).
            </p>
          )}
        </div>
      )}
    </section>
  );
}
