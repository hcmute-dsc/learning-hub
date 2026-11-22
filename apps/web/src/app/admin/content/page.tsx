import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ContentVersionView, Me } from '@hub/shared';
import { CommitLink } from '@/components/admin/CommitLink';
import { diffShort } from '@/components/admin/content-version';
import { SyncContentButton } from '@/components/admin/SyncContentButton';
import { VersionStatusBadge } from '@/components/admin/VersionStatusBadge';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

export const metadata: Metadata = { title: 'Nội dung' };

/**
 * Admin "Nội dung" (USER-FLOWS §10): sync the content repo into a draft, then an admin
 * publishes it. Content maintainers can sync and read; the API checks roles again.
 */
export default async function ContentAdminPage() {
  const { data: me } = await api<{ data: Me }>('/auth/me');
  const isAdmin = me.roles.includes('admin');
  if (!isAdmin && !me.roles.includes('content_maintainer')) notFound();

  const { data: versions } = await api<{ data: ContentVersionView[] }>('/admin/content/versions');

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Nội dung</h1>
          <p className="muted mt-1 max-w-2xl text-sm">
            Đồng bộ đọc commit mới nhất của repo nội dung và tạo một bản nháp, chưa thay đổi gì với
            thành viên. {isAdmin ? 'Bạn' : 'Admin'} mở bản nháp, xem thay đổi rồi publish.
          </p>
        </div>
        <SyncContentButton knownIds={versions.map((v) => v.id)} />
      </header>

      <section aria-labelledby="versions" className="surface rounded-xl p-5">
        <h2 id="versions" className="font-semibold">
          Các phiên bản ({versions.length})
        </h2>
        {versions.length === 0 ? (
          <p className="muted mt-3 text-sm">Chưa có phiên bản nào. Bấm “Đồng bộ từ GitHub”.</p>
        ) : (
          <div className="table-wrap mt-4 overflow-x-auto" tabIndex={0}>
            <table className="stack-table w-full md:min-w-[44rem] text-left text-sm">
              <thead className="muted">
                <tr className="border-b border-[var(--border)]">
                  <th className="py-2 pr-4 font-medium">Trạng thái</th>
                  <th className="py-2 pr-4 font-medium">Commit</th>
                  <th className="py-2 pr-4 font-medium">Thay đổi</th>
                  <th className="py-2 pr-4 font-medium">Đồng bộ lúc</th>
                  <th className="py-2 pr-4 font-medium">Người đồng bộ</th>
                  <th className="py-2 font-medium">
                    <span className="sr-only">Chi tiết</span>
                  </th>
                </tr>
              </thead>
              <tbody className="md:divide-y divide-[var(--border)]">
                {versions.map((v) => (
                  <tr key={v.id}>
                    <td data-label="Trạng thái" className="py-1 md:py-2 md:pr-4">
                      <VersionStatusBadge status={v.status} />
                    </td>
                    <td data-label="Commit" className="py-1 md:py-2 md:pr-4">
                      <CommitLink sourceRepo={v.sourceRepo} sha={v.commitSha} />
                    </td>
                    <td
                      data-label="Thay đổi"
                      className="py-1 md:py-2 md:pr-4 text-xs md:whitespace-nowrap"
                    >
                      {v.status === 'rejected' && v.summary.issueCount
                        ? `${v.summary.issueCount} lỗi`
                        : diffShort(v.summary)}
                    </td>
                    <td
                      data-label="Đồng bộ lúc"
                      className="py-1 md:py-2 md:pr-4 text-xs md:whitespace-nowrap"
                    >
                      {formatDateTime(v.createdAt)}
                    </td>
                    <td data-label="Người đồng bộ" className="py-1 md:py-2 md:pr-4 text-xs">
                      {v.syncedBy ? `@${v.syncedBy.githubLogin}` : 'Hệ thống'}
                    </td>
                    <td className="py-1 md:py-2 text-right">
                      <Link
                        href={`/admin/content/versions/${v.id}`}
                        prefetch={false}
                        className="text-sm font-medium text-brand-600 hover:underline"
                      >
                        Xem
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
