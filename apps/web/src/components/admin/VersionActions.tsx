'use client';

import { useState } from 'react';
import type { ContentVersionStatus } from '@hub/shared';
import { ProblemAlert } from '@/components/exercise/ProblemAlert';
import { sendJson } from '@/lib/client-api';
import { useMutation } from '@/lib/use-mutation';
import { ConfirmDialog } from './ConfirmDialog';
import { shortSha, versionActions, type VersionAction } from './content-version';

const BUTTON_LABEL: Record<VersionAction, string> = {
  publish: 'Publish',
  restore: 'Khôi phục bản này',
  reject: 'Từ chối',
};

/**
 * Publish / reject a draft, or publish an older version again (rollback). Every action
 * asks first: publishing changes what every member sees at once.
 */
export function VersionActions({
  id,
  commitSha,
  status,
  diffText,
  isAdmin,
}: {
  id: string;
  commitSha: string;
  status: ContentVersionStatus;
  /** short summary of the changes, shown in the confirmation */
  diffText: string;
  isAdmin: boolean;
}) {
  const [asking, setAsking] = useState<VersionAction | null>(null);
  const { run, busy, problem } = useMutation();
  const actions = versionActions(status, isAdmin);

  if (!actions.length) {
    return !isAdmin && (status === 'draft' || status === 'superseded') ? (
      <p className="muted text-sm">Chỉ admin publish hoặc từ chối được phiên bản này.</p>
    ) : null;
  }

  async function confirm() {
    if (!asking) return;
    const path = asking === 'reject' ? 'reject' : 'publish';
    await run(() =>
      sendJson(`/admin/content/versions/${encodeURIComponent(id)}/${path}`, 'POST', {}),
    );
    setAsking(null);
  }

  const sha = shortSha(commitSha);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => setAsking(action)}
            disabled={busy}
            className={
              action === 'reject'
                ? 'press rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-800 hover:border-red-500 disabled:opacity-60 dark:border-red-800 dark:text-red-300'
                : 'press rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60'
            }
          >
            {BUTTON_LABEL[action]}
          </button>
        ))}
      </div>
      <ProblemAlert problem={problem} />

      <ConfirmDialog
        open={asking !== null}
        title={
          asking === 'reject'
            ? `Từ chối bản nháp ${sha}?`
            : asking === 'restore'
              ? `Khôi phục nội dung về commit ${sha}?`
              : `Publish commit ${sha}?`
        }
        confirmLabel={asking ? BUTTON_LABEL[asking] : ''}
        danger={asking === 'reject'}
        busy={busy}
        onConfirm={confirm}
        onCancel={() => setAsking(null)}
      >
        {asking === 'reject' ? (
          <p>
            Bản nháp sẽ không publish được nữa. Muốn dùng lại commit này thì phải sửa repo nội dung.
          </p>
        ) : (
          <>
            <p>
              Nội dung mọi thành viên đang xem sẽ được thay ngay bằng commit <code>{sha}</code>.
              {asking === 'restore' && ' Đây là cách quay lại một phiên bản cũ.'}
            </p>
            <p>
              Thay đổi lúc đồng bộ: <strong>{diffText}</strong> (thêm · sửa · xóa). API tính lại
              trên dữ liệu hiện tại khi publish, nên số thật có thể khác.
            </p>
            <p>Bài bị xóa khỏi repo sẽ được lưu trữ, tiến độ của thành viên vẫn giữ.</p>
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}
