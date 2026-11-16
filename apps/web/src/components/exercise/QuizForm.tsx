'use client';

import { useState, type FormEvent } from 'react';
import type { ExerciseView, QuizResult } from '@hub/shared';
import { sendJson } from '@/lib/client-api';
import { useMutation } from '@/lib/use-mutation';
import { formatPercent } from '@/lib/format';
import { CompletedNotice } from './CompletedNotice';
import { ProblemAlert } from './ProblemAlert';
import { QuizQuestion } from './QuizQuestion';
import { countAnswered, toAttemptInput, type QuizDraft } from './quiz-answers';
import { QuizResultSummary } from './QuizResultSummary';

type Quiz = NonNullable<ExerciseView['quiz']>;

/**
 * Quiz: answer, "Nộp bài", then see the score and every correct answer with its
 * explanation (the API reveals answers only after an attempt). "Làm lại" starts over.
 * Once the quiz is completed the API refuses new attempts (409), so the form is
 * replaced by a notice; the result of the passing attempt stays visible until reload.
 */
export function QuizForm({
  exerciseId,
  quiz,
  completed,
}: {
  exerciseId: string;
  quiz: Quiz;
  completed: boolean;
}) {
  const { run, busy, problem, setProblem } = useMutation();
  const [draft, setDraft] = useState<QuizDraft>({});
  const [result, setResult] = useState<QuizResult | null>(null);

  const total = quiz.questions.length;
  const answered = countAnswered(quiz.questions, draft);

  if (completed && !result) return <CompletedNotice />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const response = await run(() =>
      sendJson<QuizResult>(
        `/exercises/${encodeURIComponent(exerciseId)}/quiz-attempts`,
        'POST',
        toAttemptInput(quiz.questions, draft),
      ),
    );
    // The result comes straight from the response, so one click shows the score.
    if (response.ok) setResult(response.data);
  }

  function retry() {
    setDraft({});
    setResult(null);
    setProblem(null);
  }

  return (
    <form onSubmit={submit} className="space-y-4" aria-describedby="quiz-pass-score">
      <p id="quiz-pass-score" className="muted text-sm">
        {total} câu hỏi · cần đạt {formatPercent(quiz.passScore)} để hoàn thành.
      </p>

      {quiz.questions.map((question, index) => (
        <QuizQuestion
          key={question.id}
          question={question}
          number={index + 1}
          value={draft[question.id]}
          onChange={(value) => setDraft({ ...draft, [question.id]: value })}
          feedback={result?.questions.find((q) => q.id === question.id) ?? null}
        />
      ))}

      <div aria-live="polite">
        {result && <QuizResultSummary result={result} passScore={quiz.passScore} />}
      </div>
      <ProblemAlert problem={problem} />

      {/* Stays in view at the bottom of the panel (or the screen on phones) while scrolling.
          The negative margin matches the panel padding (p-5 in exercises/[id]/page.tsx). */}
      {!(result && completed) && (
        <div className="sticky bottom-0 -mx-5 -mb-5 rounded-b-2xl border-t border-[var(--border)] bg-[var(--surface)] px-5 py-4">
          {result ? (
            <button
              type="button"
              onClick={retry}
              className="press w-full rounded-lg border-2 border-brand-600 px-4 py-2 font-semibold text-brand-700 hover:bg-brand-500/10"
            >
              <span aria-hidden>↻ </span>Làm lại
            </button>
          ) : (
            <div className="space-y-2.5">
              <AnswerProgress answered={answered} total={total} />
              <button
                type="submit"
                disabled={busy || answered < total}
                aria-busy={busy}
                className="press w-full rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? 'Đang chấm…' : 'Nộp bài'}
              </button>
            </div>
          )}
        </div>
      )}
    </form>
  );
}

/** "Đã trả lời x/y câu" with a thin bar that fills as questions are answered. */
function AnswerProgress({ answered, total }: { answered: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((answered / total) * 100);
  return (
    <div className="flex items-center gap-3 text-sm">
      <div aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className="h-full rounded-full bg-brand-500 transition-[width] duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="muted shrink-0 tabular-nums" aria-live="polite">
        Đã trả lời {answered}/{total} câu
      </span>
    </div>
  );
}
