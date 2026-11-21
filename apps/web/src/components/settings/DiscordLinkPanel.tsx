'use client';

import { useState } from 'react';
import type { DiscordLink, DiscordLinkResult } from '@hub/shared';
import { ProblemAlert } from '@/components/exercise/ProblemAlert';
import { sendJson } from '@/lib/client-api';
import { useMutation } from '@/lib/use-mutation';
import { discordResultMessage } from './discord-link';

/**
 * "Kết nối Discord" (learning-hub#76). Connecting is a full-page trip to Discord
 * (GET /me/discord/connect, scope `identify`); unlinking is DELETE /me/discord. Both are
 * written to the audit log by the API.
 */
export function DiscordLinkPanel({
  link,
  result,
}: {
  link: DiscordLink;
  result: DiscordLinkResult | null;
}) {
  const { run, busy, problem } = useMutation();
  const [username, setUsername] = useState(link.username);
  const message = result ? discordResultMessage(result) : null;

  async function unlink() {
    const res = await run(() => sendJson<DiscordLink>('/me/discord', 'DELETE'));
    if (res.ok) setUsername(null);
  }

  return (
    <div className="mt-4 space-y-3">
      {message && (
        <p
          role="status"
          className={`text-sm ${message.tone === 'ok' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}
        >
          {message.text}
        </p>
      )}
      {username ? (
        <div className="flex flex-wrap items-center gap-3">
          <span>
            Đã kết nối với <span className="font-medium">{username}</span>
          </span>
          <button
            type="button"
            onClick={unlink}
            disabled={busy}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:border-brand-500 disabled:opacity-60"
          >
            Huỷ kết nối
          </button>
        </div>
      ) : link.available ? (
        // A plain link: the API answers with a redirect to Discord.
        <a
          href="/api/v1/me/discord/connect"
          className="press inline-block rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Kết nối Discord
        </a>
      ) : (
        <p className="muted text-sm italic">CLB chưa bật kết nối Discord.</p>
      )}
      <ProblemAlert problem={problem} />
    </div>
  );
}
