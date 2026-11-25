'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  CONTENT_REPORT_CATEGORIES,
  CONTENT_REPORT_CATEGORY_LABEL,
  CONTENT_REPORT_DESCRIPTION_MAX,
  CONTENT_REPORT_QUOTE_MAX,
  type ContentReportCategory,
  type ContentReportTargetInput,
} from '@hub/shared';
import { sendJson } from '@/lib/client-api';
import { quoteFromSelection, sendErrorText } from './content-report-format';

const FIELD =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]';

/**
 * "Báo lỗi nội dung" (learning-hub#121): a small button on content pages that opens a form
 * in a native <dialog> (focus trap, Esc to close). Text the member selected on the page
 * becomes the "Đoạn trích". The browser sends only ids; the API finds the track and commit.
 */
export function ReportContentButton({ target }: { target: ContentReportTargetInput }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ContentReportCategory | ''>('');
  const [description, setDescription] = useState('');
  const [quote, setQuote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  function start() {
    setQuote(quoteFromSelection(window.getSelection()?.toString()));
    setError(null);
    setSent(false);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    if (sent) {
      setCategory('');
      setDescription('');
      setQuote('');
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!category || !description.trim()) {
      setError('Hãy chọn loại lỗi và ghi mô tả.');
      return;
    }
    setSending(true);
    setError(null);
    const result = await sendJson<{ id: string }>('/content-reports', 'POST', {
      target,
      category,
      description,
      ...(quote.trim() ? { quote } : {}),
    });
    setSending(false);
    if (result.ok) setSent(true);
    else setError(sendErrorText(result.problem));
  }

  return (
    <>
      <button
        type="button"
        onClick={start}
        className="press inline-flex items-center gap-1 hover:underline"
      >
        <span aria-hidden>⚑</span> Báo lỗi nội dung
      </button>
      <dialog
        ref={dialog}
        onClose={close}
        aria-labelledby={titleId}
        className="surface m-auto max-h-[calc(100dvh-2rem)] w-[min(34rem,calc(100vw-2rem))] overflow-y-auto rounded-xl p-0 text-[var(--text)] shadow-xl backdrop:bg-black/40"
      >
        {sent ? (
          <div className="space-y-3 p-5">
            <h2 id={titleId} className="text-lg font-semibold">
              Cảm ơn bạn đã báo lỗi
            </h2>
            <p className="text-sm">
              Mentor sẽ xem và sửa. Khi xử lý xong, bạn nhận thông báo ở chuông 🔔.
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={close}
                className="press rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                Đóng
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 p-5">
            <div>
              <h2 id={titleId} className="text-lg font-semibold">
                Báo lỗi nội dung
              </h2>
              <p className="muted mt-1 text-sm">
                Bài, lộ trình và phiên bản nội dung được gắn tự động. Không ghi thông tin cá nhân.
              </p>
              <p className="muted mt-1 text-sm">
                Mô tả và đoạn trích có thể được đăng công khai trong issue GitHub của lộ trình
                (không kèm tên bạn).
              </p>
            </div>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Loại lỗi</span>
              <select
                required
                value={category}
                onChange={(e) => setCategory(e.target.value as ContentReportCategory)}
                className={FIELD}
              >
                <option value="" disabled>
                  Chọn một loại
                </option>
                {CONTENT_REPORT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CONTENT_REPORT_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Mô tả</span>
              <textarea
                required
                rows={4}
                maxLength={CONTENT_REPORT_DESCRIPTION_MAX}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Sai ở đâu, nên sửa thành gì?"
                className={FIELD}
              />
              <span className="muted block text-right text-xs tabular-nums">
                {description.length}/{CONTENT_REPORT_DESCRIPTION_MAX}
              </span>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">
                Đoạn trích <span className="muted font-normal">(không bắt buộc)</span>
              </span>
              <textarea
                rows={2}
                maxLength={CONTENT_REPORT_QUOTE_MAX}
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                placeholder="Dán câu bị sai, hoặc bôi đen trên trang trước khi bấm nút"
                className={FIELD}
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={sending}
                className="press rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:border-brand-500 disabled:opacity-60"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={sending}
                aria-busy={sending}
                className="press rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {sending ? 'Đang gửi…' : 'Gửi báo lỗi'}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
