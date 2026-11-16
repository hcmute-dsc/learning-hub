'use client';

import type { CSSProperties } from 'react';
import type { QuizQuestionView, QuizResult } from '@hub/shared';
import { CheckIcon } from './CheckIcon';
import {
  describeCorrectAnswer,
  isChosen,
  optionLetter,
  optionState,
  toggleOption,
  type OptionState,
  type QuizDraft,
} from './quiz-answers';

type Feedback = QuizResult['questions'][number];

/** Look of an option row; the words in OPTION_NOTE say the same thing without color. */
const OPTION_CLASS: Record<OptionState, string> = {
  idle: 'border-[var(--border)]',
  selected: 'border-brand-500 bg-brand-50',
  correct:
    'border-emerald-500 bg-emerald-50 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-950 dark:text-emerald-50',
  wrong:
    'border-red-500 bg-red-50 text-red-950 dark:border-red-500 dark:bg-red-950 dark:text-red-50',
  missed: 'border-dashed border-emerald-500',
};

const OPTION_NOTE: Partial<Record<OptionState, string>> = {
  correct: 'Bạn chọn · đúng',
  wrong: 'Bạn chọn · sai',
  missed: 'Đáp án đúng',
};

/** Outline of the whole card once graded. */
const CARD_CLASS = {
  ungraded: 'border-[var(--border)]',
  correct: 'border-emerald-400 dark:border-emerald-700',
  incorrect: 'border-red-400 dark:border-red-700',
};

/**
 * One quiz question as a card: large clickable option rows (a real radio or checkbox
 * inside each <label>, visually hidden, so keyboard and screen readers work as usual),
 * or a text box. After grading the inputs are read-only and every row says whether it
 * was right.
 */
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
  const cardTone = feedback === null ? 'ungraded' : feedback.correct ? 'correct' : 'incorrect';

  return (
    <fieldset
      disabled={feedback !== null}
      className={`motion-fade-up rounded-xl border-2 bg-[var(--surface)] p-4 transition-colors ${CARD_CLASS[cardTone]}`}
      style={{ '--i': number } as CSSProperties}
    >
      {/* float + w-full keeps the legend inside the card instead of on its border */}
      <legend className="float-left flex w-full items-start gap-3">
        <QuestionNumber number={number} feedback={feedback} />
        <span className="min-w-0 pt-0.5 font-medium">
          <span className="sr-only">Câu {number}. </span>
          <span className="whitespace-pre-wrap">{question.prompt}</span>
          {question.type === 'multiple' && (
            <span className="muted mt-0.5 block text-sm font-normal">Chọn tất cả đáp án đúng</span>
          )}
        </span>
      </legend>

      <div className="clear-both pt-3">
        {question.type === 'short_text' ? (
          <ShortTextAnswer
            id={inputName}
            number={number}
            value={typeof value === 'string' ? value : ''}
            onChange={onChange}
            feedback={feedback}
          />
        ) : (
          <ul className="space-y-2">
            {question.options.map((option, index) => {
              const isSingle = question.type === 'single';
              return (
                <li key={`${inputName}-${index}`}>
                  <OptionRow
                    name={inputName}
                    kind={isSingle ? 'radio' : 'checkbox'}
                    letter={optionLetter(index)}
                    text={option}
                    checked={isChosen(value, index)}
                    state={optionState(value, index, feedback?.correctAnswer ?? null)}
                    graded={feedback !== null}
                    onChange={(on) => onChange(isSingle ? index : toggleOption(value, index, on))}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {feedback && <QuestionFeedback question={question} feedback={feedback} />}
    </fieldset>
  );
}

function QuestionNumber({ number, feedback }: { number: number; feedback: Feedback | null }) {
  if (feedback === null) {
    return (
      <span
        aria-hidden
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-50 font-mono text-sm font-bold text-brand-700"
      >
        {number}
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={`motion-pop grid h-7 w-7 shrink-0 place-items-center rounded-full font-bold text-white ${
        feedback.correct ? 'bg-emerald-600' : 'bg-red-600'
      }`}
    >
      {feedback.correct ? <CheckIcon /> : '✗'}
    </span>
  );
}

function OptionRow({
  name,
  kind,
  letter,
  text,
  checked,
  state,
  graded,
  onChange,
}: {
  name: string;
  kind: 'radio' | 'checkbox';
  letter: string;
  text: string;
  checked: boolean;
  state: OptionState;
  graded: boolean;
  onChange: (on: boolean) => void;
}) {
  const note = OPTION_NOTE[state];
  return (
    <label
      className={`flex items-start gap-3 rounded-lg border-2 px-3 py-2.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500 ${OPTION_CLASS[state]} ${
        graded ? 'cursor-default' : 'press cursor-pointer hover:border-brand-500'
      }`}
    >
      <input
        type={kind}
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <Indicator kind={kind} checked={checked} state={state} />
      <span className="muted mt-px font-mono text-sm">{letter}.</span>
      <span className="min-w-0 flex-1">
        {text}
        {note && (
          <span className="mt-0.5 block text-xs font-semibold tracking-wide uppercase">{note}</span>
        )}
      </span>
    </label>
  );
}

/** The drawn radio dot or checkbox tick; the real input is visually hidden. */
function Indicator({
  kind,
  checked,
  state,
}: {
  kind: 'radio' | 'checkbox';
  checked: boolean;
  state: OptionState;
}) {
  const filled =
    state === 'correct'
      ? 'border-emerald-600 bg-emerald-600'
      : state === 'wrong'
        ? 'border-red-600 bg-red-600'
        : 'border-brand-600 bg-brand-600';
  const box = `mt-0.5 grid h-5 w-5 shrink-0 place-items-center border-2 text-white ${
    kind === 'radio' ? 'rounded-full' : 'rounded-md'
  } ${checked ? filled : 'border-[var(--muted)]'}`;

  return (
    <span aria-hidden className={box}>
      {checked &&
        (kind === 'radio' ? (
          <span className="motion-pop h-2 w-2 rounded-full bg-white" />
        ) : (
          <span className="motion-pop">
            <CheckIcon className="h-3.5 w-3.5" />
          </span>
        ))}
    </span>
  );
}

function ShortTextAnswer({
  id,
  number,
  value,
  onChange,
  feedback,
}: {
  id: string;
  number: number;
  value: string;
  onChange: (value: string) => void;
  feedback: Feedback | null;
}) {
  const border =
    feedback === null
      ? 'border-[var(--border)] focus:border-brand-500'
      : feedback.correct
        ? 'border-emerald-500'
        : 'border-red-500';
  return (
    <>
      <label htmlFor={id} className="sr-only">
        Câu trả lời cho câu {number}
      </label>
      <input
        id={id}
        type="text"
        maxLength={500}
        autoComplete="off"
        placeholder="Nhập câu trả lời…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border-2 bg-[var(--surface)] px-3 py-2 font-mono transition-colors ${border}`}
      />
    </>
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
    <div className="motion-fade-up mt-4 rounded-lg bg-[var(--code-bg)] p-3 text-sm">
      <p className="font-semibold">
        {feedback.correct ? (
          <span className="text-emerald-700 dark:text-emerald-300">✓ Đúng</span>
        ) : (
          <span className="text-red-700 dark:text-red-300">✗ Chưa đúng</span>
        )}
      </p>
      <p className="mt-1">
        <span className="muted">Đáp án đúng:</span>{' '}
        {describeCorrectAnswer(question, feedback.correctAnswer)}
      </p>
      {/* Plain text on purpose: the Markdown renderer would add ~70 kB to this client bundle. */}
      {feedback.explanation && <p className="mt-2 whitespace-pre-wrap">{feedback.explanation}</p>}
    </div>
  );
}
