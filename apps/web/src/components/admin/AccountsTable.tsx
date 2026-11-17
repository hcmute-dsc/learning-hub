'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { AdminUserRow } from '@hub/shared';
import { Avatar } from '@/components/ui/Avatar';
import { ProblemAlert } from '@/components/exercise/ProblemAlert';
import { formatDateTime } from '@/lib/format';
import {
  countByStatus,
  emailsText,
  filterAccounts,
  STATUS_LABEL,
  type StatusFilter,
} from './account-filter';
import { ApproveButton } from './ApproveButton';
import { RolesCell } from './RolesCell';
import { SuspendButton } from './SuspendButton';
import { useApproveAccount } from './use-approve';

const TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'pending', label: STATUS_LABEL.pending },
  { value: 'active', label: STATUS_LABEL.active },
  { value: 'suspended', label: STATUS_LABEL.suspended },
];

const STATUS_CLASS: Record<AdminUserRow['status'], string> = {
  pending: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
  active: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200',
  suspended: 'bg-zinc-200 text-zinc-800 dark:bg-zinc-500/30 dark:text-zinc-200',
};

/**
 * Every account with its email (admin only, SECURITY §1). Filtering happens in the
 * browser: a club has at most a few thousand accounts (ADMIN_USERS_LIMIT).
 * `meId` is the viewing admin, who cannot suspend themselves or drop their own admin role.
 */
export function AccountsTable({ rows, meId }: { rows: AdminUserRow[]; meId: string }) {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const { approve, busy, problem, isApproving, isApproved } = useApproveAccount();

  const counts = useMemo(() => countByStatus(rows), [rows]);
  const shown = useMemo(() => filterAccounts(rows, status, search), [rows, status, search]);

  async function copyEmails() {
    await navigator.clipboard.writeText(emailsText(shown)).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Lọc theo trạng thái" className="flex flex-wrap gap-1.5">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={status === tab.value}
              onClick={() => setStatus(tab.value)}
              className={`press rounded-full border px-3 py-1 text-sm ${
                status === tab.value
                  ? 'border-brand-500 bg-brand-50 font-medium text-brand-700'
                  : 'border-[var(--border)] hover:border-brand-500'
              }`}
            >
              {tab.label} ({counts[tab.value]})
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm tên, GitHub hoặc email…"
          aria-label="Tìm tài khoản"
          className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm sm:max-w-xs"
        />
        <button
          type="button"
          onClick={copyEmails}
          disabled={shown.length === 0}
          className="press rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:border-brand-500 disabled:opacity-50"
        >
          <span aria-live="polite">{copied ? '✓ Đã chép' : `Chép email (${shown.length})`}</span>
        </button>
      </div>

      <ProblemAlert problem={problem} />

      {shown.length === 0 ? (
        <p className="muted text-sm">Không có tài khoản nào khớp.</p>
      ) : (
        <div className="table-wrap overflow-x-auto" tabIndex={0}>
          <table className="w-full min-w-[60rem] text-left text-sm">
            <thead className="muted">
              <tr className="border-b border-[var(--border)]">
                <th className="py-2 pr-4 font-medium">Thành viên</th>
                <th className="py-2 pr-4 font-medium">Email</th>
                <th className="py-2 pr-4 font-medium">Trạng thái</th>
                <th className="py-2 pr-4 font-medium">Vai trò</th>
                <th className="py-2 pr-4 font-medium">Tham gia</th>
                <th className="py-2 pr-4 font-medium">Đăng nhập gần nhất</th>
                <th className="py-2 font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {shown.map((row) => (
                <tr key={row.id}>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <Avatar src={row.avatarUrl} size={28} />
                      <div className="min-w-0">
                        <div className="font-medium">{row.displayName}</div>
                        {row.status === 'active' ? (
                          <Link
                            href={`/u/${row.githubLogin}`}
                            className="muted text-xs hover:text-brand-600 hover:underline"
                          >
                            @{row.githubLogin}
                          </Link>
                        ) : (
                          <span className="muted text-xs">@{row.githubLogin}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-2 pr-4">
                    {row.email ? (
                      <>
                        <span className="font-mono text-xs">{row.email}</span>
                        <div
                          className={`text-xs ${row.onEmailList ? 'text-emerald-700 dark:text-emerald-300' : 'muted'}`}
                        >
                          {row.onEmailList
                            ? '✓ Có trong danh sách CLB'
                            : 'Không có trong danh sách CLB'}
                        </div>
                      </>
                    ) : (
                      <span className="muted text-xs">GitHub không chia sẻ email</span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    {row.status === 'pending' && !isApproved(row.id) ? (
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_CLASS.pending}`}
                        >
                          {STATUS_LABEL.pending}
                        </span>
                        <ApproveButton
                          onClick={() => approve(row.id)}
                          disabled={busy}
                          approving={isApproving(row.id)}
                        />
                      </div>
                    ) : (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_CLASS[isApproved(row.id) ? 'active' : row.status]}`}
                      >
                        {STATUS_LABEL[isApproved(row.id) ? 'active' : row.status]}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-xs">
                    <RolesCell row={row} isSelf={row.id === meId} />
                  </td>
                  <td className="py-2 pr-4 text-xs whitespace-nowrap">
                    {formatDateTime(row.createdAt)}
                  </td>
                  <td className="py-2 pr-4 text-xs whitespace-nowrap">
                    {row.lastLoginAt ? formatDateTime(row.lastLoginAt) : '—'}
                  </td>
                  <td className="py-2">
                    <SuspendButton row={row} isSelf={row.id === meId} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
