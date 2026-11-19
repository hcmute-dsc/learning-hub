import type { Metadata } from 'next';
import Link from 'next/link';
import type { Me, MyCertificate, NotificationSettings } from '@hub/shared';
import { CertificateVisibility } from '@/components/certificate/CertificateVisibility';
import { AchievementsToggle } from '@/components/settings/AchievementsToggle';
import { EmailDigestToggle } from '@/components/settings/EmailDigestToggle';
import { ProfileForm } from '@/components/settings/ProfileForm';
import { ThemePicker } from '@/components/settings/ThemePicker';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Cài đặt' };

/** Personal settings: what other members see on the profile, the color scheme, the email digest. */
export default async function SettingsPage() {
  const [{ data: me }, { data: certificates }, { data: notify }] = await Promise.all([
    api<{ data: Me }>('/auth/me'),
    api<{ data: MyCertificate[] }>('/me/certificates'),
    api<{ data: NotificationSettings }>('/me/notifications/settings'),
  ]);
  return (
    <div className="motion-fade-up mx-auto max-w-2xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Cài đặt</h1>
          <p className="muted mt-1">Hồ sơ, chứng nhận và cách Learning Hub hiển thị.</p>
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

      <section aria-labelledby="certificates-heading" className="surface rounded-2xl p-5 sm:p-6">
        <h2 id="certificates-heading" className="text-lg font-semibold">
          Chứng nhận
        </h2>
        <p className="muted mt-1 text-sm">
          Hoàn thành mọi bài học và bài tập của một lộ trình để nhận chứng nhận có link xác minh. Ẩn
          khỏi hồ sơ thì thành viên khác không thấy trên hồ sơ của bạn, nhưng link bạn đã gửi vẫn mở
          được.
        </p>
        {certificates.length === 0 ? (
          <p className="muted mt-3 text-sm italic">Bạn chưa có chứng nhận nào.</p>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {certificates.map((c) => (
              <li key={c.code}>
                <CertificateVisibility certificate={c} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="theme-heading" className="surface rounded-2xl p-5 sm:p-6">
        <h2 id="theme-heading" className="text-lg font-semibold">
          Giao diện
        </h2>
        <p className="muted mt-1 text-sm">Lưu theo tài khoản, nên dùng được trên mọi thiết bị.</p>
        <ThemePicker theme={me.theme} />
      </section>

      <section aria-labelledby="achievements-heading" className="surface rounded-2xl p-5 sm:p-6">
        <h2 id="achievements-heading" className="text-lg font-semibold">
          Huy hiệu và chuỗi ngày học
        </h2>
        <p className="muted mt-1 text-sm">
          Một chút động lực nhẹ nhàng, không điểm số, không xếp hạng.
        </p>
        <AchievementsToggle show={me.showAchievements} />
      </section>

      <section aria-labelledby="notify-heading" className="surface rounded-2xl p-5 sm:p-6">
        <h2 id="notify-heading" className="text-lg font-semibold">
          Thông báo
        </h2>
        <p className="muted mt-1 text-sm">
          Chuông 🔔 trên thanh trên cùng báo khi mentor review bài của bạn, khi có bài chờ review
          (mentor) và khi có lộ trình mới. Email là tuỳ chọn, mặc định tắt.
        </p>
        <EmailDigestToggle settings={notify} />
      </section>
    </div>
  );
}
