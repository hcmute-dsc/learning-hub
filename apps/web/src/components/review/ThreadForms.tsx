'use client';

import { useId, useState, type FormEvent } from 'react';
import {
  REVIEW_MESSAGE_MAX,
  REVIEW_THANKS_MAX,
  type ReviewMessage,
  type ReviewThanksView,
} from '@hub/shared';
import { ProblemAlert } from '@/components/exercise/ProblemAlert';
import { sendJson } from '@/lib/client-api';
import { useMutation } from '@/lib/use-mutation';
import { messageError, thanksError } from './review-thread';

const FIELD_CLASS =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm transition-colors hover:border-brand-500/60 focus:border-brand-500';
const BUTTON_CLASS =
  'press min-h-11 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-0 sm:py-2';

const path = (reviewId: string, rest: string) => `/reviews/${encodeURIComponent(reviewId)}/${rest}`;

/** A new message in the conversation (Markdown). The refreshed page shows it in the list. */
export function ReplyForm({ reviewId }: { reviewId: string }) {
  const { run, busy, problem } = useMutation();
  const id = useId();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = messageError(text);
    setError(found);
    if (found) return;
    const result = await run(() =>
      sendJson<ReviewMessage>(path(reviewId, 'messages'), 'POST', { bodyMd: text.trim() }),
    );
    if (result.ok) setText('');
  }

  return (
    <form onSubmit={submit} noValidate className="mt-3 space-y-2">
      <label htmlFor={id} className="sr-only">
        Tin nhắn
      </label>
      <textarea
        id={id}
        rows={3}
        maxLength={REVIEW_MESSAGE_MAX}
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : `${id}-hint`}
        placeholder="Viết câu hỏi hoặc trả lời…"
        className={FIELD_CLASS}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id={`${id}-hint`} className="muted text-xs">
          Hỗ trợ Markdown. Chỉ thành viên, mentor của review này và admin đọc được.
        </p>
        <button type="submit" disabled={busy} aria-busy={busy} className={BUTTON_CLASS}>
          {busy ? 'Đang gửi…' : 'Gửi'}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} className="text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <ProblemAlert problem={problem} />
    </form>
  );
}

/** The member's one thank-you note to the mentor (plain text, cannot be edited). */
export function ThanksForm({ reviewId }: { reviewId: string }) {
  const { run, busy, problem } = useMutation();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 min-h-11 text-sm font-medium text-brand-600 underline-offset-2 hover:underline sm:min-h-0"
      >
        <span aria-hidden>💛 </span>Gửi lời cảm ơn mentor
      </button>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = thanksError(text);
    setError(found);
    if (found) return;
    await run(() =>
      sendJson<ReviewThanksView>(path(reviewId, 'thanks'), 'POST', { body: text.trim() }),
    );
  }

  return (
    <form onSubmit={submit} noValidate className="mt-3 space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        Lời cảm ơn mentor
      </label>
      <textarea
        id={id}
        rows={2}
        maxLength={REVIEW_THANKS_MAX}
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-hint`}
        className={FIELD_CLASS}
      />
      <p id={`${id}-hint`} className="muted text-xs">
        Gửi một lần, không sửa được. Mentor có thể chọn hiện lời cảm ơn này, kèm tên bạn, trên hồ sơ
        của họ.
      </p>
      {error && <p className="text-xs text-red-700 dark:text-red-300">{error}</p>}
      <button type="submit" disabled={busy} aria-busy={busy} className={BUTTON_CLASS}>
        {busy ? 'Đang gửi…' : 'Gửi lời cảm ơn'}
      </button>
      <ProblemAlert problem={problem} />
    </form>
  );
}

/** The mentor shows or hides the note on their profile. */
export function ThanksVisibility({ reviewId, isPublic }: { reviewId: string; isPublic: boolean }) {
  const { run, busy, problem } = useMutation();
  return (
    <div className="mt-2">
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs sm:min-h-0">
        <input
          type="checkbox"
          checked={isPublic}
          disabled={busy}
          onChange={(e) =>
            run(() =>
              sendJson<ReviewThanksView>(path(reviewId, 'thanks/visibility'), 'PUT', {
                isPublic: e.target.checked,
              }),
            )
          }
        />
        Hiện trên hồ sơ của tôi
      </label>
      <ProblemAlert problem={problem} />
    </div>
  );
}
