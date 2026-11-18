import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import type { AdminOverview } from '@hub/shared';
import { adminHomeFor } from '@/components/admin/admin-tabs';
import { shortSha, waitLabel } from '@/components/admin/overview-format';
import { api, getMe } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

export const metadata: Metadata = { title: 'Quản trị' };

/**
 * /admin: the overview for admins (issue #29, INFORMATION-ARCHITECTURE §9). Other roles
 * have no overview and go to the first tab they may open. Counts only, no emails.
 */
export default async function AdminIndexPage() {
  const me = await getMe();
  if (!me) redirect('/login');
  if (!me.roles.includes('admin')) {
    const home = adminHomeFor(me.roles);
    if (!home) notFound();
    redirect(home);
  }

  const { data: o } = await api<{ data: AdminOverview }>('/admin/overview');

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Tổng quan</h1>
        <p className="muted mt-1 max-w-2xl text-sm">
          Số liệu lúc tải trang. Bấm vào một ô để mở trang chi tiết.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card href="/admin/members" title="Thành viên">
          <Stat value={o.members.active} label="đang hoạt động" />
          <Stat value={o.members.pending} label="chờ duyệt" warn={o.members.pending > 0} />
          <Stat value={o.members.suspended} label="tạm khóa" />
        </Card>

        <Card href="/admin/content" title="Nội dung">
          <p className="text-sm">
            {o.content.published ? (
              <>
                Đang publish: <code>{shortSha(o.content.published.commitSha)}</code>
                {o.content.published.publishedAt
                  ? ` · ${formatDateTime(o.content.published.publishedAt)}`
                  : null}
              </>
            ) : (
              'Chưa publish phiên bản nào.'
            )}
          </p>
          <Stat value={o.content.drafts} label="bản nháp chờ" warn={o.content.drafts > 0} />
        </Card>

        <Card href="/review" title="Review">
          <Stat value={o.reviews.waiting} label="bài chờ review" />
          <p className="text-sm">
            {o.reviews.oldest ? (
              <span className={o.reviews.oldest.overTarget ? 'font-medium text-red-600' : ''}>
                Chờ lâu nhất: {waitLabel(o.reviews.oldest.hoursWaiting)}
                {o.reviews.oldest.overTarget ? ` (quá ${o.reviews.targetHours} giờ)` : null}
              </span>
            ) : (
              <span className="muted">Không có bài nào đang chờ.</span>
            )}
          </p>
        </Card>

        <Card href="/admin/audit" title={`Hoạt động ${o.activity.days} ngày qua`}>
          <Stat value={o.activity.signedIn} label="thành viên đăng nhập" />
          <Stat value={o.activity.submissions} label="bài nộp" />
          <Stat value={o.activity.adminActions} label="thao tác quản trị" />
        </Card>
      </div>
    </section>
  );
}

function Card({ href, title, children }: { href: string; title: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="surface press block space-y-2 rounded-xl p-5 transition-colors hover:border-brand-500"
    >
      <h2 className="font-semibold">{title} →</h2>
      {children}
    </Link>
  );
}

function Stat({ value, label, warn = false }: { value: number; label: string; warn?: boolean }) {
  return (
    <p className="text-sm">
      <span className={`text-2xl font-bold ${warn ? 'text-amber-600' : ''}`}>{value}</span>{' '}
      <span className="muted">{label}</span>
    </p>
  );
}
