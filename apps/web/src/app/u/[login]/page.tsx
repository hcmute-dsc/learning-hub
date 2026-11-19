import type { Metadata } from 'next';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { CertificateView, MemberProfile } from '@hub/shared';
import { CertificateList } from '@/components/certificate/CertificateList';
import { EnrollmentCard } from '@/components/learn/EnrollmentCard';
import { BadgeGrid } from '@/components/achievements/BadgeGrid';
import { badgeCards } from '@/components/achievements/achievements';
import { ActivityGrid } from '@/components/profile/ActivityGrid';
import { ROLE_LABEL, formatMonth, visibleRoles } from '@/components/profile/profile';
import { Avatar } from '@/components/ui/Avatar';
import { api, apiOrNotFound } from '@/lib/api';

type Params = { params: Promise<{ login: string }> };

/** GitHub logins only; anything else is a 404 without calling the API. */
const LOGIN = /^[A-Za-z0-9-]{1,39}$/;

async function loadProfile(login: string): Promise<MemberProfile> {
  const path = `/members/${encodeURIComponent(LOGIN.test(login) ? login : '-')}`;
  return (await apiOrNotFound<{ data: MemberProfile }>(path)).data;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { login } = await params;
  return { title: `Hồ sơ @${login}` };
}

/** Member profile, visible to signed-in club members (decided 17/11/2026). */
export default async function ProfilePage({ params }: Params) {
  const { login } = await params;
  const profile = await loadProfile(login);
  // Certificates the member did not hide (PRD F19); loaded after the profile, which 404s first.
  const { data: certificates } = await api<{ data: CertificateView[] }>(
    `/members/${encodeURIComponent(profile.githubLogin)}/certificates`,
  );
  const { stats, achievements } = profile;

  // The streak tile is left out when the member hid achievements (F12, /settings).
  const tiles = [
    ...(achievements
      ? [
          {
            icon: '🔥',
            value: achievements.streak.current,
            label: 'Chuỗi ngày học',
            hint: `Dài nhất ${achievements.streak.longest} ngày`,
          },
        ]
      : [{ icon: '📅', value: stats.activeDays, label: 'Ngày có học' }]),
    { icon: '📖', value: stats.lessonsCompleted, label: 'Bài học đã xong' },
    { icon: '🛠️', value: stats.exercisesCompleted, label: 'Bài tập hoàn thành' },
    {
      icon: '🏁',
      value: stats.tracksCompleted,
      label: 'Lộ trình hoàn thành',
      hint: achievements ? `${stats.activeDays} ngày có học` : undefined,
    },
  ];
  const badges = achievements ? badgeCards(achievements.badges, false) : [];

  return (
    <div className="space-y-8">
      <header className="surface motion-fade-up flex flex-col gap-5 rounded-2xl p-5 sm:flex-row sm:items-center sm:p-6">
        <Avatar src={profile.avatarUrl} size={96} className="motion-pop" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold break-words">{profile.displayName}</h1>
          <p className="muted mt-0.5">
            <a
              href={`https://github.com/${profile.githubLogin}`}
              className="hover:text-brand-600 hover:underline"
              rel="noopener noreferrer"
            >
              @{profile.githubLogin}
            </a>
            {' · '}Tham gia {formatMonth(profile.joinedAt)}
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Vai trò">
            {visibleRoles(profile.roles).map((role) => (
              <li
                key={role}
                className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700"
              >
                {ROLE_LABEL[role]}
              </li>
            ))}
          </ul>
          {profile.bio ? (
            <p className="mt-3 whitespace-pre-line">{profile.bio}</p>
          ) : (
            profile.isMe && (
              <p className="muted mt-3 text-sm italic">
                Bạn chưa viết giới thiệu. Thêm vài dòng để bạn bè trong CLB biết bạn đang học gì.
              </p>
            )
          )}
        </div>
        {profile.isMe && (
          <Link
            href="/settings"
            className="press self-start rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:border-brand-500"
          >
            ✏️ Chỉnh sửa hồ sơ
          </Link>
        )}
      </header>

      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">
          Thống kê học tập
        </h2>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map((tile, index) => (
            <li
              key={tile.label}
              className="surface lift motion-fade-up rounded-2xl p-4"
              style={{ '--i': index + 1 } as CSSProperties}
            >
              <span aria-hidden className="text-2xl">
                {tile.icon}
              </span>
              <p className="mt-1 text-3xl font-bold tabular-nums">{tile.value}</p>
              <p className="text-sm font-medium">{tile.label}</p>
              {tile.hint && <p className="muted text-xs">{tile.hint}</p>}
            </li>
          ))}
        </ul>
      </section>

      {achievements && (
        <section
          aria-labelledby="badges-heading"
          className="surface motion-fade-up rounded-2xl p-5 sm:p-6"
        >
          <h2 id="badges-heading" className="mb-4 text-lg font-semibold">
            Huy hiệu ({badges.length})
          </h2>
          {badges.length === 0 ? (
            <p className="muted text-sm">
              {profile.isMe
                ? 'Hoàn thành bài học đầu tiên để nhận huy hiệu đầu tiên.'
                : 'Thành viên này chưa có huy hiệu nào.'}
            </p>
          ) : (
            <BadgeGrid cards={badges} />
          )}
        </section>
      )}

      <section
        aria-labelledby="activity-heading"
        className="surface motion-fade-up rounded-2xl p-5 sm:p-6"
      >
        <h2 id="activity-heading" className="mb-4 text-lg font-semibold">
          Hoạt động học tập
        </h2>
        <ActivityGrid days={profile.activity} />
      </section>

      {certificates.length > 0 && (
        <section aria-labelledby="certificates-heading">
          <h2 id="certificates-heading" className="text-lg font-semibold">
            Chứng nhận ({certificates.length})
          </h2>
          <CertificateList certificates={certificates} />
          {profile.isMe && (
            <p className="muted mt-2 text-sm">
              Ẩn chứng nhận khỏi hồ sơ trong{' '}
              <Link href="/settings" className="text-brand-600 hover:underline">
                Cài đặt
              </Link>
              .
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="tracks-heading">
        <h2 id="tracks-heading" className="text-lg font-semibold">
          Lộ trình ({profile.tracks.length})
        </h2>
        {profile.tracks.length === 0 ? (
          <p className="surface muted mt-3 rounded-2xl p-5 text-sm">
            {profile.isMe ? (
              <>
                Bạn chưa tham gia lộ trình nào.{' '}
                <Link href="/tracks" className="font-medium text-brand-600 hover:underline">
                  Khám phá lộ trình
                </Link>
              </>
            ) : (
              'Thành viên này chưa tham gia lộ trình nào.'
            )}
          </p>
        ) : (
          <ul className="surface mt-3 divide-y divide-[var(--border)] overflow-hidden rounded-2xl">
            {profile.tracks.map((track) => (
              <li key={track.trackId}>
                <EnrollmentCard track={track} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
