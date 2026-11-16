import type { Metadata } from 'next';
import Link from 'next/link';
import type { Me, TrackProgress } from '@hub/shared';
import { EnrollmentCard } from '@/components/learn/EnrollmentCard';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Bảng điều khiển' };

export default async function DashboardPage() {
  const [{ data: me }, { data: enrollments }] = await Promise.all([
    api<{ data: Me }>('/auth/me'),
    api<{ data: TrackProgress[] }>('/me/enrollments'),
  ]);

  return (
    <section>
      <h1 className="text-2xl font-bold">Chào {me.displayName} 👋</h1>

      <section aria-labelledby="continue-learning" className="mt-6">
        <h2 id="continue-learning" className="font-semibold">
          Tiếp tục học
        </h2>
        {enrollments.length === 0 ? (
          // FRONTEND-DESIGN §8: an empty state always says what to do next.
          <div className="surface mt-3 rounded-xl p-5">
            <p className="muted text-sm">Bạn chưa tham gia lộ trình nào.</p>
            <Link
              href="/tracks"
              className="mt-3 inline-block rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700"
            >
              Khám phá lộ trình →
            </Link>
          </div>
        ) : (
          <ul className="mt-3 grid gap-4 md:grid-cols-2">
            {enrollments.map((track) => (
              <li key={track.trackId}>
                <EnrollmentCard track={track} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="my-roles" className="surface mt-6 rounded-xl p-5">
        <h2 id="my-roles" className="font-semibold">
          Vai trò của bạn
        </h2>
        <p className="muted mt-1 text-sm">{me.roles.join(', ')}</p>
      </section>
    </section>
  );
}
