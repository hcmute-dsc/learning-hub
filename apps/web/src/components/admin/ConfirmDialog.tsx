'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Ask before an admin action that is hard to undo (grant admin, suspend, publish).
 * The native <dialog> gives focus trapping, Esc to cancel and a backdrop for free.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      aria-labelledby="confirm-title"
      className="surface m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl p-0 text-[var(--text)] shadow-xl backdrop:bg-black/40"
    >
      <div className="p-5">
        <h2 id="confirm-title" className="text-lg font-semibold">
          {title}
        </h2>
        <div className="mt-2 space-y-2 text-sm">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="press rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:border-brand-500 disabled:opacity-60"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
            className={`press rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 ${
              danger ? 'bg-red-700 hover:bg-red-800' : 'bg-brand-600 hover:bg-brand-700'
            }`}
          >
            {busy ? 'Đang xử lý…' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
