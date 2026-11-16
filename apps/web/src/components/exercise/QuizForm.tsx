'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { ExerciseView, ProblemDetails, QuizResult } from '@hub/shared';
import { sendJson } from '@/lib/client-api';
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
  const router = useRouter();
  const [draft, setDraft] = useState<QuizDraft>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [problem, setProblem] = useState<ProblemDetails | null>(null);
  const [pending, setPending] = useState(false);

  const total = quiz.questions.length;
  const answered = countAnswered(quiz.questions, draft);

  if (completed && !result) return <CompletedNotice />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setProblem(null);
    const response = await sendJson<QuizResult>(
      `/exercises/${encodeURIComponent(exerciseId)}/quiz-attempts`,
      'POST',
      toAttemptInput(quiz.questions, draft),
    );
    setPending(false);
    if (!response.ok) {
      setProblem(response.problem);
      return;
    }
    setResult(response.data);
    // The exercise state and the attempt history are server-rendered: reload them.
    router.refresh();
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
            disabled={pending || answered < total}
            aria-busy={pending}
            className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {pending ? 'Đang chấm…' : 'Nộp bài'}
          </button>
          <span className="muted text-sm" aria-live="polite">
            Đã trả lời {answered}/{total} câu
          </span>
        </div>
      )}
    </form>
  );
}
