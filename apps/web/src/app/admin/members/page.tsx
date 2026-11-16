import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ApprovedEmailList, Me } from '@hub/shared';
import { ApprovedEmailsForm } from '@/components/admin/ApprovedEmailsForm';
import { PendingAccounts } from '@/components/admin/PendingAccounts';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

export const metadata: Metadata = { title: 'Thành viên' };

/**
 * Admin "Thành viên": approve waiting accounts (mentor + admin) and manage the club's
 * email list (admin only — personal data, SECURITY §1). The API checks the roles again.
 */
export default async function MembersAdminPage() {
  const { data: me } = await api<{ data: Me }>('/auth/me');
  const isAdmin = me.roles.includes('admin');
  if (!isAdmin && !me.roles.includes('mentor')) notFound();

  const [pending, list] = await Promise.all([
    api<{ data: Me[] }>('/admin/users/pending').then((r) => r.data),
    isAdmin ? api<{ data: ApprovedEmailList }>('/admin/approved-emails').then((r) => r.data) : null,
  ]);

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Thành viên</h1>
        <p className="muted mt-1 max-w-2xl text-sm">
          Tài khoản GitHub có email đã xác minh nằm trong danh sách email của CLB sẽ được duyệt tự
          động khi đăng nhập. Các tài khoản khác chờ ở đây để mentor hoặc admin duyệt.
        </p>
      </header>

      <section aria-labelledby="pending" className="surface rounded-xl p-5">
        <h2 id="pending" className="font-semibold">
          Đang chờ duyệt ({pending.length})
        </h2>
        <div className="mt-3">
          <PendingAccounts users={pending} />
        </div>
      </section>

      {list && (
        <section aria-labelledby="email-list" className="surface rounded-xl p-5">
          <h2 id="email-list" className="font-semibold">
            Danh sách email thành viên ({list.total})
          </h2>
          <p className="muted mt-1 text-sm">
            Đây là dữ liệu cá nhân: chỉ admin xem được, không chia sẻ ra ngoài.
          </p>
          <div className="mt-4">
            <ApprovedEmailsForm currentTotal={list.total} />
          </div>

          {list.total > 0 && (
            <details className="mt-6">
              <summary className="cursor-pointer font-medium">
                Xem {list.total} email trong danh sách
              </summary>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="muted">
                    <tr>
                      <th className="py-1 pr-4 font-medium">Email</th>
                      <th className="py-1 pr-4 font-medium">Ghi chú</th>
                      <th className="py-1 font-medium">Thêm lúc</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {list.emails.map((row) => (
                      <tr key={row.email}>
                        <td className="py-1 pr-4 font-mono">{row.email}</td>
                        <td className="py-1 pr-4">{row.note ?? '—'}</td>
                        <td className="py-1">{formatDateTime(row.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </section>
      )}
    </section>
  );
}
