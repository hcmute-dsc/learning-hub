'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { LeaderboardPostStatus } from '@hub/shared';
import { ProblemAlert } from '@/components/exercise/ProblemAlert';
import { sendJson } from '@/lib/client-api';
import { useMutation } from '@/lib/use-mutation';
import { ConfirmDialog } from './ConfirmDialog';
import { postActions } from './leaderboard-post';

/**
 * "Đăng ngay" / "Cập nhật" for last week's leaderboard post (learning-hub#83).
 * Posting is public and pings the linked members, so it asks first; editing pings nobody.
 */
export function LeaderboardPostActions({ status }: { status: LeaderboardPostStatus }) {
  const { run, busy, problem } = useMutation();
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const actions = postActions(status);
  // A failure can still change the state (Discord down → queued; message deleted on
  // Discord → not posted), so reload the page data to show the right button.
  const router = useRouter();

  async function post() {
    setDone(null);
    const res = await run(() =>
      sendJson<LeaderboardPostStatus>('/admin/leaderboard-post/post', 'POST'),
    );
    setConfirming(false);
    if (res.ok) setDone('Đã đăng lên kênh CLB.');
    else router.refresh();
  }

  async function update() {
    setDone(null);
    const res = await run(() =>
      sendJson<LeaderboardPostStatus>('/admin/leaderboard-post/update', 'POST'),
    );
    if (res.ok) setDone('Đã sửa bài trên Discord.');
    else router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {status.state !== 'posted' && (
          <button
            type="button"
            disabled={!actions.canPost || busy}
            onClick={() => setConfirming(true)}
            className="press rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Đăng ngay
          </button>
        )}
        {status.state === 'posted' && (
          <button
            type="button"
            disabled={!actions.canUpdate || busy}
            onClick={update}
            className="press rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:border-brand-500 disabled:opacity-50"
          >
            {busy ? 'Đang cập nhật…' : 'Cập nhật'}
          </button>
        )}
      </div>
      {actions.hint && <p className="muted text-sm">{actions.hint}</p>}
      {done && (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {done}
        </p>
      )}
      <ProblemAlert problem={problem} />
      <ConfirmDialog
        open={confirming}
        title={`Đăng bảng xếp hạng tuần ${status.weekId}?`}
        confirmLabel="Đăng"
        busy={busy}
        onConfirm={post}
        onCancel={() => setConfirming(false)}
      >
        Bài hiện ngay trên kênh Discord của CLB và tag những thành viên đã kết nối Discord. Mỗi tuần
        chỉ đăng một lần; sau đó dùng “Cập nhật” để sửa bài.
      </ConfirmDialog>
    </div>
  );
}
