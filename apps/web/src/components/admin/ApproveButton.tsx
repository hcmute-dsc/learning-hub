'use client';

/** "Duyệt" button for one pending account (state from useApproveAccount). */
export function ApproveButton({
  onClick,
  disabled,
  approving,
}: {
  onClick: () => void;
  disabled: boolean;
  approving: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={approving}
      className="press rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium whitespace-nowrap hover:border-brand-500 disabled:opacity-60"
    >
      {approving ? 'Đang duyệt…' : 'Duyệt'}
    </button>
  );
}
