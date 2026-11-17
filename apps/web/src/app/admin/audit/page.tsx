import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { AuditLogRow, AuditPage, Me } from '@hub/shared';
import { actionLabel } from '@/components/admin/audit-format';
import { AuditTable } from '@/components/admin/AuditTable';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Nhật ký' };

/** Same rule as the API's query schema, so a hand-edited URL shows everything instead of failing. */
const ACTION_CODE = /^[a-z_.]{1,60}$/;

/** Admin "Nhật ký" (SECURITY §11): who changed roles, accounts, the email list and content. */
export default async function AuditPageRoute({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const { data: me } = await api<{ data: Me }>('/auth/me');
  if (!me.roles.includes('admin')) notFound();

  const { action: rawAction } = await searchParams;
  const action = rawAction && ACTION_CODE.test(rawAction) ? rawAction : null;
  const query = action ? `?action=${encodeURIComponent(action)}` : '';

  const [actions, first] = await Promise.all([
    api<{ data: string[] }>('/admin/audit/actions').then((r) => r.data),
    api<{ data: AuditLogRow[]; page: AuditPage }>(`/admin/audit${query}`),
  ]);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Nhật ký</h1>
        <p className="muted mt-1 max-w-2xl text-sm">
          Các thao tác quản trị: duyệt, đổi vai trò, tạm khóa tài khoản, cập nhật danh sách email
          (chỉ ghi số lượng) và đồng bộ, publish nội dung. Mới nhất ở trên.
        </p>
      </header>

      <section className="surface rounded-xl p-5">
        {/* A plain GET form: filtering works without JavaScript and the URL can be shared. */}
        <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
          <label htmlFor="action" className="text-sm font-medium">
            Hành động
          </label>
          <select
            id="action"
            name="action"
            defaultValue={action ?? ''}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm"
          >
            <option value="">Tất cả</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {actionLabel(a)}
              </option>
            ))}
          </select>
          <button className="press rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:border-brand-500">
            Lọc
          </button>
        </form>
        {/* key: a new filter starts a new list instead of keeping the old "Xem thêm" pages */}
        <AuditTable
          key={action ?? 'all'}
          initialRows={first.data}
          initialCursor={first.page.nextCursor}
          action={action}
        />
      </section>
    </section>
  );
}
