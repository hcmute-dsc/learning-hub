'use client';

import { useState } from 'react';
import type { Me } from '@hub/shared';
import { ProblemAlert } from '@/components/exercise/ProblemAlert';
import { sendJson } from '@/lib/client-api';
import { useMutation } from '@/lib/use-mutation';

/**
 * Show or hide badges and the streak (PRD F12) → PUT /me/settings. Hidden means hidden
 * everywhere: the dashboard card and the profile, also for other members.
 */
export function AchievementsToggle({ show }: { show: boolean }) {
  const { run, busy, problem } = useMutation();
  const [checked, setChecked] = useState(show);

  async function toggle(next: boolean) {
    setChecked(next);
    const res = await run(() => sendJson<Me>('/me/settings', 'PUT', { showAchievements: next }));
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
          <span className="font-medium">Hiện huy hiệu và chuỗi ngày học</span>
          <span className="muted block text-sm">
            Tắt thì huy hiệu và chuỗi ngày học bị ẩn trên bảng điều khiển và hồ sơ của bạn. Huy hiệu
            vẫn được ghi nhận, bật lại là thấy.
          </span>
        </span>
      </label>
      <ProblemAlert problem={problem} />
    </div>
  );
}
