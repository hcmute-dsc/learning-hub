import type { Metadata } from 'next';
import Link from 'next/link';
import type { Me } from '@hub/shared';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Bảng điều khiển' };

export default async function DashboardPage() {
  const { data: me } = await api<{ data: Me }>('/auth/me');
  return (
    <section>
      <h1 className="text-2xl font-bold">Chào {me.displayName} 👋</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="surface rounded-xl p-5">
          <h2 className="font-semibold">Tiếp tục học</h2>
          <p className="muted mt-1 text-sm">Bạn chưa tham gia lộ trình nào.</p>
          <Link href="/tracks" className="mt-3 inline-block font-medium text-brand-600">
            Khám phá lộ trình →
          </Link>
        </div>
        <div className="surface rounded-xl p-5">
          <h2 className="font-semibold">Vai trò của bạn</h2>
          <p className="muted mt-1 text-sm">{me.roles.join(', ')}</p>
        </div>
      </div>
    </section>
  );
}
