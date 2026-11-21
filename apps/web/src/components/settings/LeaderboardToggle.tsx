'use client';

import { useState } from 'react';
import type { Me } from '@hub/shared';
import { ProblemAlert } from '@/components/exercise/ProblemAlert';
import { sendJson } from '@/lib/client-api';
import { useMutation } from '@/lib/use-mutation';

/**
 * Appear on the term leaderboard or not (E14, ADR-08) → PUT /me/settings. Off by
 * default; turning it off removes the member from the board at the next read.
 */
export function LeaderboardToggle({ optedIn }: { optedIn: boolean }) {
  const { run, busy, problem } = useMutation();
  const [checked, setChecked] = useState(optedIn);

  async function toggle(next: boolean) {
    setChecked(next);
    const res = await run(() => sendJson<Me>('/me/settings', 'PUT', { leaderboardOptIn: next }));
    if (!res.ok) setChecked(!next);
  }

  return (
    <div className="mt-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          disabled={busy}
          onChange={(e) => toggle(e.target.checked)}
          className="mt-1 size-4 accent-brand-600"
        />
        <span>
          <span className="font-medium">Hiện tôi trên bảng xếp hạng</span>
          <span className="muted block text-sm">
            Thành viên CLB thấy tên, ảnh và số bài bạn hoàn thành trong học kỳ. Tắt là bạn biến mất
            khỏi bảng ngay.
          </span>
        </span>
      </label>
      <ProblemAlert problem={problem} />
    </div>
  );
}
