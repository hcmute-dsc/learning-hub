'use client';

import dynamic from 'next/dynamic';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  CONTENT_REPORT_CATEGORIES,
  CONTENT_REPORT_CATEGORY_LABEL,
  CONTENT_REPORT_DESCRIPTION_MAX,
  CONTENT_REPORT_QUOTE_MAX,
  type ContentReportCategory,
  type ContentReportTargetInput,
} from '@hub/shared';
import { sendJson } from '@/lib/client-api';
import {
  CATEGORY_ICON,
  DESCRIPTION_PLACEHOLDER,
  insertCodeBlock,
  insertTemplate,
  isSubmitShortcut,
  missingField,
  quoteFromSelection,
  sendErrorText,
  targetKindLabel,
  type TextEdit,
} from './content-report-format';

// The Markdown renderer is large (react-markdown, highlight.js): load it only when the
// member opens "Xem trước".
const Markdown = dynamic(() => import('@/components/markdown/Markdown').then((m) => m.Markdown), {
  loading: () => <p className="muted text-sm">Đang tải bản xem trước…</p>,
});

const FIELD =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]';
const SMALL_BUTTON =
  'press inline-flex min-h-11 items-center gap-1 rounded-md border border-[var(--border)] px-2.5 text-xs hover:border-brand-500 sm:min-h-8';

type Tab = 'write' | 'preview';

/**
 * "Báo lỗi nội dung" (learning-hub#121, #125): a small button on content pages that opens a
 * form in a native <dialog> (focus trap, Esc to close, focus back on the button).
 * - The form says which lesson or page it is about.
 * - Category: chips that are real radio buttons in a fieldset (arrow keys move between them).
 * - Description: Markdown, with Viết / Xem trước tabs, a "Khối code" button and a
 *   "Sai / Nên là" template. The preview uses the lesson renderer for member text
 *   (Markdown from="member"): no raw HTML, no images loaded, same as the staff page.
 * - Text the member selected on the page becomes the "Đoạn trích".
 * - Ctrl/Cmd+Enter sends. The browser sends only ids; the API finds the track and commit.
 */
export function ReportContentButton({
  target,
  title,
  trackTitle,
}: {
  target: ContentReportTargetInput;
  /** Name of the lesson, exercise or page, shown in the dialog */
  title: string;
  trackTitle: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const firstChip = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const doneButton = useRef<HTMLButtonElement>(null);
  const ids = {
    title: useId(),
    category: useId(),
    description: useId(),
    descriptionHelp: useId(),
    writeTab: useId(),
    previewTab: useId(),
    writePanel: useId(),
    previewPanel: useId(),
    quote: useId(),
    error: useId(),
  };
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ContentReportCategory | ''>('');
  const [description, setDescription] = useState('');
  const [quote, setQuote] = useState('');
  const [tab, setTab] = useState<Tab>('write');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The field the error is about, marked aria-invalid until it is fixed */
  const [invalid, setInvalid] = useState<'category' | 'description' | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // Start at the category: the checked chip if there is one (a draft), else the first.
      const checked = d.querySelector<HTMLInputElement>('input[type="radio"]:checked');
      (checked ?? firstChip.current)?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);

  // The form is gone once the report is sent; keep focus inside the dialog.
  useEffect(() => {
    if (sent) doneButton.current?.focus();
  }, [sent]);

  function start() {
    // A new selection replaces the quote; without one, the draft's quote stays.
    const selected = quoteFromSelection(window.getSelection()?.toString());
    if (selected) setQuote(selected);
    setError(null);
    setInvalid(null);
    setSent(false);
    setTab('write');
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

  /** Applies a toolbar edit and puts the cursor (or selection) back in the textarea. */
  function applyEdit(make: (value: string, start: number, end: number) => TextEdit | null) {
    const el = descriptionRef.current;
    if (!el) return;
    const edit = make(description, el.selectionStart, el.selectionEnd);
    if (!edit) {
      setError(`Mô tả tối đa ${CONTENT_REPORT_DESCRIPTION_MAX} ký tự.`);
      setInvalid('description');
      return;
    }
    changeDescription(edit.value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(edit.selectionStart, edit.selectionEnd);
    });
  }

  /** An error about a field goes away once that field is fixed. */
  function clearErrorFor(field: 'category' | 'description') {
    if (invalid !== field) return;
    setInvalid(null);
    setError(null);
  }

  function changeDescription(value: string) {
    setDescription(value);
    if (value.trim() && value.length <= CONTENT_REPORT_DESCRIPTION_MAX) {
      clearErrorFor('description');
    }
  }

  function showTab(next: Tab) {
    setTab(next);
    document.getElementById(next === 'write' ? ids.writeTab : ids.previewTab)?.focus();
  }

  /** Tabs pattern (WAI-ARIA): arrow keys, Home and End move between the two tabs. */
  function onTabKey(e: KeyboardEvent) {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      if (e.key === 'Home') showTab('write');
      else if (e.key === 'End') showTab('preview');
      else showTab(tab === 'write' ? 'preview' : 'write');
    }
  }

  function onFormKey(e: KeyboardEvent<HTMLFormElement>) {
    if (isSubmitShortcut(e) && !sending) {
      e.preventDefault();
      e.currentTarget.requestSubmit();
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    const missing = missingField(category, description);
    if (missing) {
      setError(missing.message);
      setInvalid(missing.field);
      if (missing.field === 'category') firstChip.current?.focus();
      else {
        setTab('write');
        requestAnimationFrame(() => descriptionRef.current?.focus());
      }
      return;
    }
    setSending(true);
    setError(null);
    setInvalid(null);
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
        // Esc must not close the dialog while the report is being sent.
        onCancel={(e) => {
          if (sending) e.preventDefault();
        }}
        aria-labelledby={ids.title}
        className="surface m-auto max-h-[calc(100dvh-2rem)] w-[min(40rem,calc(100vw-2rem))] overflow-y-auto rounded-xl p-0 text-[var(--text)] shadow-xl backdrop:bg-black/40"
      >
        {sent ? (
          <div className="space-y-3 p-4 sm:p-5">
            <h2 id={ids.title} className="text-lg font-semibold">
              Cảm ơn bạn đã báo lỗi
            </h2>
            <p className="text-sm">
              Mentor sẽ xem và sửa. Khi xử lý xong, bạn nhận thông báo ở chuông 🔔.
            </p>
            <div className="flex justify-end">
              <button
                ref={doneButton}
                type="button"
                onClick={close}
                className="press min-h-11 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700 sm:min-h-9"
              >
                Đóng
              </button>
            </div>
          </div>
        ) : (
          <form noValidate onSubmit={submit} onKeyDown={onFormKey} className="space-y-4 p-4 sm:p-5">
            <div>
              <h2 id={ids.title} className="text-lg font-semibold">
                Báo lỗi nội dung
              </h2>
              <p className="mt-1 text-sm break-words">
                <span className="muted">{targetKindLabel(target.kind)}:</span>{' '}
                <span className="font-medium">{title}</span>
                <span className="muted"> · {trackTitle}</span>
              </p>
              <p className="muted mt-2 text-xs">
                Mô tả và đoạn trích có thể được đăng công khai trong issue GitHub của lộ trình
                (không kèm tên bạn). Không ghi thông tin cá nhân. Dấu{' '}
                <span className="text-red-700 dark:text-red-300">*</span> là bắt buộc.
              </p>
            </div>

            <fieldset aria-describedby={invalid === 'category' ? ids.error : undefined}>
              <legend className="text-sm font-medium">
                Loại lỗi <Required />
              </legend>
              <div id={ids.category} className="mt-2 flex flex-wrap gap-2">
                {CONTENT_REPORT_CATEGORIES.map((c, i) => (
                  <label
                    key={c}
                    className="press inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-[var(--border)] px-3 text-sm hover:border-brand-500 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:checked]:font-medium has-[:checked]:text-brand-700 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500 sm:min-h-9"
                  >
                    <input
                      ref={i === 0 ? firstChip : undefined}
                      type="radio"
                      name={ids.category}
                      value={c}
                      required
                      checked={category === c}
                      aria-invalid={invalid === 'category' || undefined}
                      onChange={() => {
                        setCategory(c);
                        clearErrorFor('category');
                      }}
                      className="sr-only"
                    />
                    <span aria-hidden className="text-xs">
                      {CATEGORY_ICON[c]}
                    </span>
                    {CONTENT_REPORT_CATEGORY_LABEL[c]}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="space-y-2">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <label htmlFor={ids.description} className="text-sm font-medium">
                  Mô tả <Required />
                </label>
                <div role="tablist" aria-label="Mô tả" className="flex gap-1 text-sm">
                  <TabButton
                    id={ids.writeTab}
                    panel={ids.writePanel}
                    active={tab === 'write'}
                    onSelect={() => setTab('write')}
                    onKeyDown={onTabKey}
                  >
                    Viết
                  </TabButton>
                  <TabButton
                    id={ids.previewTab}
                    panel={ids.previewPanel}
                    active={tab === 'preview'}
                    onSelect={() => setTab('preview')}
                    onKeyDown={onTabKey}
                  >
                    Xem trước
                  </TabButton>
                </div>
              </div>

              <div
                role="tabpanel"
                id={ids.writePanel}
                aria-labelledby={ids.writeTab}
                hidden={tab !== 'write'}
                className="space-y-2"
              >
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => applyEdit(insertCodeBlock)}
                    className={SMALL_BUTTON}
                  >
                    <span aria-hidden className="font-mono">
                      {'</>'}
                    </span>
                    Chèn khối code
                  </button>
                  <button
                    type="button"
                    onClick={() => applyEdit(insertTemplate)}
                    className={SMALL_BUTTON}
                  >
                    Chèn mẫu &quot;Sai / Nên là&quot;
                  </button>
                </div>
                <textarea
                  ref={descriptionRef}
                  id={ids.description}
                  required
                  aria-required
                  aria-invalid={invalid === 'description' || undefined}
                  aria-describedby={
                    invalid === 'description'
                      ? `${ids.error} ${ids.descriptionHelp}`
                      : ids.descriptionHelp
                  }
                  rows={6}
                  maxLength={CONTENT_REPORT_DESCRIPTION_MAX}
                  value={description}
                  onChange={(e) => changeDescription(e.target.value)}
                  placeholder={DESCRIPTION_PLACEHOLDER}
                  className={`${FIELD} min-h-32 resize-y`}
                />
              </div>

              <div
                role="tabpanel"
                id={ids.previewPanel}
                aria-labelledby={ids.previewTab}
                hidden={tab !== 'preview'}
                tabIndex={0}
                className="min-h-32 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              >
                {tab === 'preview' &&
                  (description.trim() ? (
                    <Markdown source={description} from="member" />
                  ) : (
                    <p className="muted italic">Chưa có gì để xem trước.</p>
                  ))}
              </div>

              <p
                id={ids.descriptionHelp}
                className="muted flex flex-wrap justify-between gap-x-3 text-xs"
              >
                <span>Hỗ trợ Markdown (**đậm**, `code`, khối code). Ctrl/⌘ + Enter để gửi.</span>
                <span className="tabular-nums">
                  {description.length}/{CONTENT_REPORT_DESCRIPTION_MAX}
                </span>
              </p>
            </div>

            <div className="space-y-1">
              <label htmlFor={ids.quote} className="block text-sm font-medium">
                Đoạn trích <span className="muted font-normal">(không bắt buộc)</span>
              </label>
              <textarea
                id={ids.quote}
                rows={3}
                maxLength={CONTENT_REPORT_QUOTE_MAX}
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                placeholder="Dán câu bị sai, hoặc bôi đen trên trang trước khi bấm nút"
                className={`${FIELD} font-mono`}
              />
            </div>

            {error && (
              <p id={ids.error} role="alert" className="text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={sending}
                className="press min-h-11 rounded-lg border border-[var(--border)] px-3 text-sm hover:border-brand-500 disabled:opacity-60 sm:min-h-9"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={sending}
                aria-busy={sending}
                className="press min-h-11 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60 sm:min-h-9"
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

/** The required-field star; screen readers get "required" from the field itself. */
function Required() {
  return (
    <span aria-hidden className="text-red-700 dark:text-red-300">
      *
    </span>
  );
}

function TabButton({
  id,
  panel,
  active,
  onSelect,
  onKeyDown,
  children,
}: {
  id: string;
  panel: string;
  active: boolean;
  onSelect: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={active}
      aria-controls={panel}
      tabIndex={active ? 0 : -1}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={`min-h-11 rounded-md px-3 sm:min-h-8 ${
        active ? 'bg-brand-50 font-medium text-brand-700' : 'muted hover:text-brand-600'
      }`}
    >
      {children}
    </button>
  );
}
