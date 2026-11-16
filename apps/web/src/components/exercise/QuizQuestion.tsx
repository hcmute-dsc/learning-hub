'use client';

import type { QuizQuestionView, QuizResult } from '@hub/shared';
import { describeCorrectAnswer, optionLetter, toggleOption, type QuizDraft } from './quiz-answers';

type Feedback = QuizResult['questions'][number];

/** One quiz question: radios, checkboxes or a text box, plus feedback after grading. */
export function QuizQuestion({
  question,
  number,
  value,
  onChange,
  feedback,
}: {
  question: QuizQuestionView;
  number: number;
  value: QuizDraft[string] | undefined;
  onChange: (value: QuizDraft[string]) => void;
  /** Set once the attempt is graded; the inputs are then read-only */
  feedback: Feedback | null;
}) {
  const inputName = `question-${question.id}`;

  return (
    <fieldset className="surface rounded-xl p-4" disabled={feedback !== null}>
      <legend className="px-1 font-medium">
        <span className="muted font-mono">Câu {number}.</span>{' '}
        <span className="whitespace-pre-wrap">{question.prompt}</span>
        {question.type === 'multiple' && (
          <span className="muted text-sm font-normal"> (chọn tất cả đáp án đúng)</span>
        )}
      </legend>

      {question.type === 'short_text' ? (
        <div className="mt-2">
          <label htmlFor={inputName} className="sr-only">
            Câu trả lời cho câu {number}
          </label>
          <input
            id={inputName}
            type="text"
            maxLength={500}
            autoComplete="off"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 font-mono"
          />
        </div>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {question.options.map((option, index) => {
            const id = `${inputName}-${index}`;
            const isSingle = question.type === 'single';
            const checked = isSingle
              ? value === index
              : Array.isArray(value) && value.includes(index);
            return (
              <li key={id} className="flex items-start gap-2">
                <input
                  id={id}
                  type={isSingle ? 'radio' : 'checkbox'}
                  name={inputName}
                  checked={checked}
                  onChange={(e) =>
                    onChange(isSingle ? index : toggleOption(value, index, e.target.checked))
                  }
                  className="mt-1.5"
                />
                <label htmlFor={id}>
                  <span className="muted font-mono">{optionLetter(index)}.</span> {option}
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {feedback && <QuestionFeedback question={question} feedback={feedback} />}
    </fieldset>
  );
}

function QuestionFeedback({
  question,
  feedback,
}: {
  question: QuizQuestionView;
  feedback: Feedback;
}) {
  return (
    <div className="mt-3 border-t border-[var(--border)] pt-3 text-sm">
      <p className="font-medium">
        {feedback.correct ? (
          <span className="text-emerald-700 dark:text-emerald-300">✓ Đúng</span>
        ) : (
          <span className="text-red-700 dark:text-red-300">✗ Chưa đúng</span>
        )}
      </p>
      <p className="mt-1">Đáp án đúng: {describeCorrectAnswer(question, feedback.correctAnswer)}</p>
      {/* Plain text on purpose: the Markdown renderer would add ~70 kB to this client bundle. */}
      {feedback.explanation && <p className="mt-2 whitespace-pre-wrap">{feedback.explanation}</p>}
    </div>
  );
}
