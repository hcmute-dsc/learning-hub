'use client';

import { useState } from 'react';
import type { Me } from '@hub/shared';
import { ProblemAlert } from '@/components/exercise/ProblemAlert';
import { sendJson } from '@/lib/client-api';
import { useMutation } from '@/lib/use-mutation';

/**
 * Accounts waiting for approval (no verified email on the club list).
 * POST /admin/users/:id/approve — mentors and admins (USER-FLOWS §1).
 */
export function PendingAccounts({ users }: { users: Me[] }) {
  const { run, busy, problem } = useMutation();
  // Which row was clicked, so only that button says "Đang duyệt…".
  const [clickedId, setClickedId] = useState<string | null>(null);
  const [approvedIds, setApprovedIds] = useState<string[]>([]);
  const waiting = users.filter((u) => !approvedIds.includes(u.id));

  async function approve(user: Me) {
    setClickedId(user.id);
    const result = await run(() =>
      sendJson(`/admin/users/${encodeURIComponent(user.id)}/approve`, 'POST'),
    );
    if (result.ok) setApprovedIds((ids) => [...ids, user.id]);
  }

  if (waiting.length === 0) {
    return <p className="muted text-sm">Không có tài khoản nào đang chờ duyệt.</p>;
  }

  return (
    <>
      <ul className="divide-y divide-[var(--border)]">
        {waiting.map((user) => (
          <li key={user.id} className="flex items-center justify-between gap-3 py-2">
            <span>
              <span className="font-medium">{user.displayName}</span>{' '}
              <a
                className="muted text-sm hover:underline"
                href={`https://github.com/${encodeURIComponent(user.githubLogin)}`}
              >
                @{user.githubLogin}
              </a>
            </span>
            <button
              type="button"
              onClick={() => approve(user)}
              disabled={busy}
              aria-busy={busy && clickedId === user.id}
              className="rounded-md border border-[var(--border)] px-3 py-1 text-sm font-medium hover:border-brand-500 disabled:opacity-60"
            >
              {busy && clickedId === user.id ? 'Đang duyệt…' : 'Duyệt'}
            </button>
          </li>
        ))}
      </ul>
      <ProblemAlert problem={problem} />
    </>
  );
}
