import type { Metadata } from 'next';
import Link from 'next/link';
import type { Me } from '@hub/shared';
import { ProfileForm } from '@/components/settings/ProfileForm';
import { ThemePicker } from '@/components/settings/ThemePicker';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Cài đặt' };

/** Personal settings: what other members see on the profile, and the color scheme. */
export default async function SettingsPage() {
  const { data: me } = await api<{ data: Me }>('/auth/me');
  return (
    <div className="motion-fade-up mx-auto max-w-2xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Cài đặt</h1>
          <p className="muted mt-1">Hồ sơ của bạn và cách Learning Hub hiển thị.</p>
        </div>
        <Link
          href={`/u/${me.githubLogin}`}
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          Xem hồ sơ của bạn →
        </Link>
      </header>

      <section aria-labelledby="profile-heading" className="surface rounded-2xl p-5 sm:p-6">
        <h2 id="profile-heading" className="text-lg font-semibold">
          Hồ sơ
        </h2>
        <p className="muted mt-1 text-sm">
          Thành viên CLB đã đăng nhập xem được tên, giới thiệu và tiến độ học của bạn. Email không
          bao giờ hiện trên hồ sơ.
        </p>
        <ProfileForm displayName={me.displayName} bio={me.bio} />
      </section>

      <section aria-labelledby="theme-heading" className="surface rounded-2xl p-5 sm:p-6">
        <h2 id="theme-heading" className="text-lg font-semibold">
          Giao diện
        </h2>
        <p className="muted mt-1 text-sm">Lưu theo tài khoản, nên dùng được trên mọi thiết bị.</p>
        <ThemePicker theme={me.theme} />
      </section>

      <section aria-labelledby="notify-heading" className="surface rounded-2xl p-5 sm:p-6">
        <h2 id="notify-heading" className="text-lg font-semibold">
          Thông báo
        </h2>
        <p className="muted mt-1 text-sm">
          Learning Hub chưa gửi thông báo nào. Thông báo khi mentor nhận xét bài sẽ có ở bản sau, và
          bạn sẽ chọn nhận hay không ở đây.
        </p>
      </section>
    </div>
  );
}
