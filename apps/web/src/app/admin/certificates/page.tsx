import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ADMIN_CERTIFICATES_LIMIT, type AdminCertificateRow, type Me } from '@hub/shared';
import { RevokeCertificateButton } from '@/components/admin/RevokeCertificateButton';
import { certificatePath } from '@/components/certificate/certificate';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

export const metadata: Metadata = { title: 'Chứng nhận' };

/** Admin "Chứng nhận" (PRD F19): issued certificates, newest first, with revoke. */
export default async function AdminCertificatesPage() {
  const { data: me } = await api<{ data: Me }>('/auth/me');
  if (!me.roles.includes('admin')) notFound();
  const { data: rows } = await api<{ data: AdminCertificateRow[] }>('/admin/certificates');

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Chứng nhận</h1>
        <p className="muted mt-1 max-w-2xl text-sm">
          Hub tự cấp chứng nhận khi thành viên hoàn thành mọi bài học và bài tập của một lộ trình.
          Thu hồi khi chứng nhận không đúng (ví dụ nộp bài của người khác); lý do được ghi vào Nhật
          ký. Hiện tối đa {ADMIN_CERTIFICATES_LIMIT} chứng nhận mới nhất.
        </p>
      </header>

      <section className="surface overflow-x-auto rounded-xl">
        {rows.length === 0 ? (
          <p className="muted p-5 text-sm">Chưa có chứng nhận nào.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="muted border-b border-[var(--border)] text-xs uppercase">
              <tr>
                <th className="px-4 py-2 font-medium">Thành viên</th>
                <th className="px-4 py-2 font-medium">Lộ trình</th>
                <th className="px-4 py-2 font-medium">Hoàn thành</th>
                <th className="px-4 py-2 font-medium">Trạng thái</th>
                <th className="px-4 py-2 font-medium">
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((row) => (
                <tr key={row.code}>
                  <td className="px-4 py-2">
                    <span className="block font-medium">{row.recipientName}</span>
                    {row.githubLogin && (
                      <Link
                        href={`/u/${row.githubLogin}`}
                        className="muted text-xs hover:text-brand-600 hover:underline"
                      >
                        @{row.githubLogin}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={certificatePath(row.code)}
                      className="hover:text-brand-600 hover:underline"
                    >
                      {row.track.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">{formatDateTime(row.completedAt)}</td>
                  <td className="px-4 py-2">
                    {row.status === 'revoked' ? (
                      <span title={row.revokeReason ?? undefined}>
                        Đã thu hồi
                        {row.revokedAt ? ` (${formatDateTime(row.revokedAt)})` : ''}
                      </span>
                    ) : (
                      <span>
                        Hiệu lực{row.hidden ? <span className="muted"> · ẩn khỏi hồ sơ</span> : ''}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <RevokeCertificateButton row={row} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </section>
  );
}
