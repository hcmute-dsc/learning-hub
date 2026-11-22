'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { AuditLogRow, AuditPage, ProblemDetails, UserRef } from '@hub/shared';
import { ProblemAlert } from '@/components/exercise/ProblemAlert';
import { Avatar } from '@/components/ui/Avatar';
import { getJson } from '@/lib/client-api';
import { formatDateTime } from '@/lib/format';
import { actionLabel, describeAudit } from './audit-format';

function Person({ user }: { user: UserRef | null }) {
  if (!user) return <span className="muted">Hệ thống</span>;
  return (
    <span className="flex items-center gap-1.5">
      <Avatar src={user.avatarUrl} size={20} />
      <span title={user.displayName}>@{user.githubLogin}</span>
    </span>
  );
}

/** What was acted on: an account, a content version, or the raw entity. */
function Target({ row }: { row: AuditLogRow }) {
  if (row.target) return <Person user={row.target} />;
  if (row.entityType === 'content_version') {
    return (
      <Link
        href={`/admin/content/versions/${row.entityId}`}
        prefetch={false}
        className="hover:text-brand-600 hover:underline"
      >
        Phiên bản nội dung
      </Link>
    );
  }
  if (row.entityType === 'approved_emails') return <span>Danh sách email</span>;
  if (row.entityType === 'certificate') return <span>Chứng nhận</span>;
  if (row.entityType === 'report') return <span>Báo cáo tiến độ</span>;
  return (
    <span className="muted font-mono text-xs">
      {row.entityType}/{row.entityId.slice(0, 8)}
    </span>
  );
}

/**
 * Audit rows, newest first. The first page comes from the server; "Xem thêm" fetches
 * the next ones in the browser and appends them, so the list keeps its place.
 */
export function AuditTable({
  initialRows,
  initialCursor,
  action,
}: {
  initialRows: AuditLogRow[];
  initialCursor: string | null;
  action: string | null;
}) {
  const [rows, setRows] = useState(initialRows);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<ProblemDetails | null>(null);

  async function loadMore() {
    if (!cursor) return;
    setLoading(true);
    setProblem(null);
    const params = new URLSearchParams({ cursor });
    if (action) params.set('action', action);
    const res = await getJson<{ data: AuditLogRow[]; page: AuditPage }>(`/admin/audit?${params}`);
    if (res.ok) {
      setRows((old) => [...old, ...res.data.data]);
      setCursor(res.data.page.nextCursor);
    } else {
      setProblem(res.problem);
    }
    setLoading(false);
  }

  if (rows.length === 0) {
    return <p className="muted text-sm">Chưa có mục nào trong nhật ký.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="table-wrap overflow-x-auto" tabIndex={0}>
        <table className="stack-table w-full md:min-w-[48rem] text-left text-sm">
          <thead className="muted">
            <tr className="border-b border-[var(--border)]">
              <th className="py-2 pr-4 font-medium">Thời gian</th>
              <th className="py-2 pr-4 font-medium">Người thực hiện</th>
              <th className="py-2 pr-4 font-medium">Hành động</th>
              <th className="py-2 pr-4 font-medium">Đối tượng</th>
              <th className="py-2 font-medium">Chi tiết</th>
            </tr>
          </thead>
          <tbody className="md:divide-y divide-[var(--border)]">
            {rows.map((row) => (
              <tr key={row.id}>
                <td
                  data-label="Thời gian"
                  className="py-1 md:py-2 md:pr-4 text-xs md:whitespace-nowrap"
                >
                  {formatDateTime(row.createdAt)}
                </td>
                <td data-label="Người thực hiện" className="py-1 md:py-2 md:pr-4">
                  <Person user={row.actor} />
                </td>
                <td
                  data-label="Hành động"
                  className="py-1 md:py-2 md:pr-4 font-medium md:whitespace-nowrap"
                >
                  {actionLabel(row.action)}
                </td>
                <td data-label="Đối tượng" className="py-1 md:py-2 md:pr-4">
                  <Target row={row} />
                </td>
                <td data-label="Chi tiết" className="py-1 md:py-2 text-xs break-words">
                  {describeAudit(row)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ProblemAlert problem={problem} />
      {cursor && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          aria-busy={loading}
          className="press rounded-lg border border-[var(--border)] px-4 py-1.5 text-sm hover:border-brand-500 disabled:opacity-60"
        >
          {loading ? 'Đang tải…' : 'Xem thêm'}
        </button>
      )}
    </div>
  );
}
