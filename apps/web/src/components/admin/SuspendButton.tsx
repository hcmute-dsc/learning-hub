'use client';

import { useState } from 'react';
import type { AdminUserRow } from '@hub/shared';
import { ProblemAlert } from '@/components/exercise/ProblemAlert';
import { sendJson } from '@/lib/client-api';
import { useMutation } from '@/lib/use-mutation';
import { ConfirmDialog } from './ConfirmDialog';

/**
 * "Tạm khóa" / "Mở khóa" for one account (admin). Suspending signs the person out
 * everywhere, so it asks first; reactivating is harmless and does not.
 * You cannot suspend yourself (the API refuses it too).
 */
export function SuspendButton({ row, isSelf }: { row: AdminUserRow; isSelf: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const { run, busy, problem } = useMutation();
  const id = encodeURIComponent(row.id);

  async function suspend() {
    await run(() => sendJson(`/admin/users/${id}/suspend`, 'POST'));
    setConfirming(false);
  }

  if (isSelf) return <span className="muted text-xs">Tài khoản của bạn</span>;

  const button =
    'press rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap disabled:opacity-60';

  return (
    <div>
      {row.status === 'suspended' ? (
        <button
          type="button"
          onClick={() => run(() => sendJson(`/admin/users/${id}/reactivate`, 'POST'))}
          disabled={busy}
          aria-busy={busy}
          className={`${button} border-[var(--border)] hover:border-brand-500`}
        >
          {busy ? 'Đang mở…' : 'Mở khóa'}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={busy}
          className={`${button} border-red-300 text-red-800 hover:border-red-500 dark:border-red-800 dark:text-red-300`}
        >
          Tạm khóa
        </button>
      )}
      <ProblemAlert problem={problem} />

      <ConfirmDialog
        open={confirming}
        title={`Tạm khóa @${row.githubLogin}?`}
        confirmLabel="Tạm khóa"
        danger
        busy={busy}
        onConfirm={suspend}
        onCancel={() => setConfirming(false)}
      >
        <p>
          <strong>{row.displayName}</strong> sẽ bị đăng xuất khỏi mọi thiết bị và không đăng nhập
          lại được cho tới khi admin mở khóa. Dữ liệu học tập vẫn được giữ nguyên.
        </p>
      </ConfirmDialog>
    </div>
  );
}
