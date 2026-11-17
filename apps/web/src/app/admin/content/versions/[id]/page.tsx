import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ContentVersionView, Me, UserRef } from '@hub/shared';
import { CommitLink } from '@/components/admin/CommitLink';
import { diffRows, diffShort, shortSha } from '@/components/admin/content-version';
import { VersionActions } from '@/components/admin/VersionActions';
import { VersionStatusBadge } from '@/components/admin/VersionStatusBadge';
import { api, apiOrNotFound } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

export const metadata: Metadata = { title: 'Phiên bản nội dung' };

const who = (user: UserRef | null) => (user ? `@${user.githubLogin}` : 'Hệ thống');

/** One content version: what changed against the catalog, validation errors, actions. */
export default async function ContentVersionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: me } = await api<{ data: Me }>('/auth/me');
  const isAdmin = me.roles.includes('admin');
  if (!isAdmin && !me.roles.includes('content_maintainer')) notFound();

  const { data: v } = await apiOrNotFound<{ data: ContentVersionView }>(
    `/admin/content/versions/${encodeURIComponent(id)}`,
  );
  const rows = diffRows(v.summary);
  const issues = v.summary.issues ?? [];

  return (
    <section className="space-y-6">
      <header>
        <Link href="/admin/content" className="muted text-sm hover:text-brand-600">
          ← Nội dung
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">Commit {shortSha(v.commitSha)}</h1>
          <VersionStatusBadge status={v.status} />
        </div>
        <dl className="muted mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          <dt>Nguồn</dt>
          <dd className="font-mono text-xs break-all">{v.sourceRepo}</dd>
          <dt>Commit</dt>
          <dd>
            <CommitLink sourceRepo={v.sourceRepo} sha={v.commitSha} />
          </dd>
          <dt>Đồng bộ</dt>
          <dd>
            {formatDateTime(v.createdAt)} · {who(v.syncedBy)}
          </dd>
          {v.publishedAt && (
            <>
              <dt>Publish</dt>
              <dd>
                {formatDateTime(v.publishedAt)} · {who(v.publishedBy)}
              </dd>
            </>
          )}
        </dl>
      </header>

      <VersionActions
        id={v.id}
        commitSha={v.commitSha}
        status={v.status}
        diffText={diffShort(v.summary)}
        isAdmin={isAdmin}
      />

      <section aria-labelledby="diff" className="surface rounded-xl p-5">
        <h2 id="diff" className="font-semibold">
          Thay đổi so với nội dung đang dùng
        </h2>
        <p className="muted mt-1 text-sm">
          {v.status === 'published' || v.status === 'superseded'
            ? 'Số liệu lúc publish.'
            : 'Số liệu lúc đồng bộ; khi publish API tính lại trên dữ liệu hiện tại.'}
        </p>
        {rows ? (
          <div className="table-wrap mt-4 overflow-x-auto" tabIndex={0}>
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead className="muted">
                <tr className="border-b border-[var(--border)]">
                  <th className="py-2 pr-4 font-medium">Loại</th>
                  <th className="py-2 pr-4 font-medium">Thêm</th>
                  <th className="py-2 pr-4 font-medium">Sửa</th>
                  <th className="py-2 pr-4 font-medium">Xóa (lưu trữ)</th>
                  <th className="py-2 font-medium">Giữ nguyên</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] tabular-nums">
                {rows.map((r) => (
                  <tr key={r.kind}>
                    <td className="py-2 pr-4 font-medium">{r.label}</td>
                    <td className="py-2 pr-4 text-emerald-700 dark:text-emerald-300">
                      {r.added ? `+${r.added}` : '0'}
                    </td>
                    <td className="py-2 pr-4 text-amber-700 dark:text-amber-300">
                      {r.changed ? `~${r.changed}` : '0'}
                    </td>
                    <td className="py-2 pr-4 text-red-700 dark:text-red-300">
                      {r.removed ? `−${r.removed}` : '0'}
                    </td>
                    <td className="muted py-2">{r.unchanged}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted mt-3 text-sm">Không có so sánh: nội dung ở commit này chưa hợp lệ.</p>
        )}
        {v.summary.counts && (
          <p className="muted mt-3 text-sm">
            Commit này có {v.summary.counts.tracks} lộ trình, {v.summary.counts.modules} chương,{' '}
            {v.summary.counts.lessons} bài học, {v.summary.counts.exercises} bài tập.
          </p>
        )}
      </section>

      {issues.length > 0 && (
        <section
          aria-labelledby="issues"
          className="rounded-xl border border-red-300 bg-red-50 p-5 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
        >
          <h2 id="issues" className="font-semibold">
            Lỗi kiểm tra nội dung ({v.summary.issueCount ?? issues.length})
          </h2>
          <p className="mt-1 text-sm">Sửa các lỗi này trong repo nội dung rồi đồng bộ lại.</p>
          <ul className="mt-3 space-y-1 text-sm">
            {issues.map((issue, i) => (
              <li key={`${issue.path}-${i}`}>
                <code className="font-mono text-xs">{issue.path}</code>: {issue.message}
              </li>
            ))}
          </ul>
          {(v.summary.issueCount ?? 0) > issues.length && (
            <p className="mt-2 text-sm">Chỉ hiện {issues.length} lỗi đầu tiên.</p>
          )}
        </section>
      )}
    </section>
  );
}
