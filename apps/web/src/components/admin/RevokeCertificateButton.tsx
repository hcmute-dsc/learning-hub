'use client';

import { useState } from 'react';
import { REVOKE_REASON_MAX, type AdminCertificateRow } from '@hub/shared';
import { ProblemAlert } from '@/components/exercise/ProblemAlert';
import { sendJson } from '@/lib/client-api';
import { useMutation } from '@/lib/use-mutation';
import { ConfirmDialog } from './ConfirmDialog';

/**
 * "Thu hồi" for one certificate (admin). Asks for a reason, which goes to the audit log;
 * the public page then says "đã bị thu hồi" (without the reason). Cannot be undone here.
 */
export function RevokeCertificateButton({ row }: { row: AdminCertificateRow }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  const { run, busy, problem } = useMutation();
  const valid = reason.trim().length >= 3;

  async function revoke() {
    setTried(true);
    if (!valid) return;
    const result = await run(() =>
      sendJson(`/admin/certificates/${encodeURIComponent(row.code)}/revoke`, 'POST', {
        reason: reason.trim(),
      }),
    );
    if (result.ok) setOpen(false);
  }

  if (row.status === 'revoked') return <span className="muted text-xs">Đã thu hồi</span>;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press rounded-md border border-red-300 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-red-800 hover:border-red-500 dark:border-red-800 dark:text-red-300"
      >
        Thu hồi
      </button>
      <ConfirmDialog
        open={open}
        title={`Thu hồi chứng nhận của @${row.githubLogin}?`}
        confirmLabel="Thu hồi"
        danger
        busy={busy}
        onConfirm={revoke}
        onCancel={() => setOpen(false)}
      >
        <p>
          Chứng nhận <strong>{row.track.title}</strong> của <strong>{row.recipientName}</strong> sẽ
          hiện là đã thu hồi trên trang xác minh và biến mất khỏi hồ sơ. Không cấp lại được.
        </p>
        <label htmlFor={`reason-${row.code}`} className="mt-3 block text-sm font-medium">
          Lý do (ghi vào nhật ký, không hiện công khai)
        </label>
        <textarea
          id={`reason-${row.code}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={REVOKE_REASON_MAX}
          rows={3}
          required
          aria-invalid={tried && !valid}
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
        />
        {tried && !valid && (
          <p className="text-sm text-red-700 dark:text-red-300">Nhập lý do, ít nhất 3 ký tự.</p>
        )}
        <ProblemAlert problem={problem} />
      </ConfirmDialog>
    </div>
  );
}
