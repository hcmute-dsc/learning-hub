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
    // useMutation also reloads the server-rendered exercise state and attempt history.
    const response = await run(() =>
      sendJson<QuizResult>(
        `/exercises/${encodeURIComponent(exerciseId)}/quiz-attempts`,
        'POST',
        toAttemptInput(quiz.questions, draft),
      ),
    );
    if (response.ok) setResult(response.data);
  }

  function retry() {
    setDraft({});
    setResult(null);
    setProblem(null);
  }

  return (
    <form onSubmit={submit} className="space-y-5" aria-describedby="quiz-pass-score">
      <p id="quiz-pass-score" className="muted text-sm">
        Cần đạt {formatPercent(quiz.passScore)} số điểm để hoàn thành.
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

      {result ? (
        !completed && (
          <button
            type="button"
            onClick={retry}
            className="rounded-lg border border-[var(--border)] px-4 py-2 font-medium"
          >
            Làm lại
          </button>
        )
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={busy || answered < total}
            aria-busy={busy}
            className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? 'Đang chấm…' : 'Nộp bài'}
          </button>
          <span className="muted text-sm" aria-live="polite">
            Đã trả lời {answered}/{total} câu
          </span>
        </div>
      )}
    </form>
  );
}
