'use client';

import { useState } from 'react';
import type { NotificationSettings } from '@hub/shared';
import { ProblemAlert } from '@/components/exercise/ProblemAlert';
import { sendJson } from '@/lib/client-api';
import { useMutation } from '@/lib/use-mutation';
import { digestHint } from './email-digest';

/**
 * "Email tóm tắt" switch → PUT /me/notifications/settings (learning-hub#49).
 * Off by default. Disabled with a reason when the server has no SMTP or the account
 * has no email; turning it off is always possible.
 */
export function EmailDigestToggle({ settings }: { settings: NotificationSettings }) {
  const { run, busy, problem } = useMutation();
  const [on, setOn] = useState(settings.emailDigest);
  const hint = digestHint(settings);
  const canTurnOn = settings.emailAvailable && settings.hasEmail;

  async function change(next: boolean) {
    setOn(next);
    const res = await run(() =>
      sendJson<NotificationSettings>('/me/notifications/settings', 'PUT', { emailDigest: next }),
    );
    if (!res.ok) setOn(!next);
  }

  return (
    <div className="mt-4">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={on}
          disabled={busy || (!on && !canTurnOn)}
          onChange={(e) => change(e.target.checked)}
          className="mt-1 h-4 w-4 accent-brand-600"
          aria-describedby="digest-hint"
        />
        <span>
          <span className="font-medium">Email tóm tắt mỗi ngày</span>
          <span id="digest-hint" className="muted block text-sm">
            {hint}
          </span>
        </span>
      </label>
      <ProblemAlert problem={problem} />
    </div>
  );
}
