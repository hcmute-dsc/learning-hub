'use client';

import type { Me } from '@hub/shared';
import { ProblemAlert } from '@/components/exercise/ProblemAlert';
import { ApproveButton } from './ApproveButton';
import { useApproveAccount } from './use-approve';

/**
 * Accounts waiting for approval (no verified email on the club list).
 * Mentors and admins can approve them (USER-FLOWS §1).
 */
export function PendingAccounts({ users }: { users: Me[] }) {
  const { approve, busy, problem, isApproving, isApproved } = useApproveAccount();
  const waiting = users.filter((u) => !isApproved(u.id));

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
            <ApproveButton
              onClick={() => approve(user.id)}
              disabled={busy}
              approving={isApproving(user.id)}
            />
          </li>
        ))}
      </ul>
      <ProblemAlert problem={problem} />
    </>
  );
}
