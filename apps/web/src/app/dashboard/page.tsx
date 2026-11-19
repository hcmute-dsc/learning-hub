import type { Metadata } from 'next';
import type { Achievements, Me, TrackProgress } from '@hub/shared';
import { AchievementsCard } from '@/components/achievements/AchievementsCard';
import { MyTracks } from '@/components/dashboard/MyTracks';
import { StartCards, type StartCard } from '@/components/dashboard/StartCards';
import { WelcomeHeader } from '@/components/dashboard/WelcomeHeader';
import { encouragement, pickContinueTrack } from '@/components/dashboard/dashboard';
import { itemHref } from '@/components/learn/links';
import { api } from '@/lib/api';
import { CLUB_LINKS } from '@/lib/club';

export const metadata: Metadata = { title: 'Bảng điều khiển' };

const MENTORING_URL = 'https://mentoring.hcmute-dsc.io.vn';

/** Member home, laid out like Exercism's dashboard: start cards left, my tracks right. */
export default async function DashboardPage() {
  const [{ data: me }, { data: enrollments }, { data: achievements }] = await Promise.all([
    api<{ data: Me }>('/auth/me'),
    api<{ data: TrackProgress[] }>('/me/enrollments'),
    // null when the member hid badges and streak in /settings (F12)
    api<{ data: Achievements | null }>('/me/achievements'),
  ]);

  return (
    <div className="space-y-8">
      <WelcomeHeader name={me.displayName} message={encouragement(enrollments)} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <StartCards cards={startCards(enrollments)} />
        <div className="space-y-8">
          {achievements && <AchievementsCard achievements={achievements} />}
          <MyTracks enrollments={enrollments} />
        </div>
      </div>
    </div>
  );
}

function startCards(enrollments: TrackProgress[]): StartCard[] {
  const cards: StartCard[] = [];
  const current = pickContinueTrack(enrollments);
  if (current?.next) {
    cards.push({
      emoji: '🚀',
      title: 'Tiếp tục học',
      description: `${current.title}: ${current.next.title}`,
      href: itemHref(current.next),
      cta: 'Học tiếp',
    });
  }
  cards.push(
    {
      emoji: '🧭',
      title: 'Khám phá lộ trình',
      description: 'Tìm lộ trình mới với bài học ngắn và bài tập thực hành.',
      href: '/tracks',
      cta: 'Xem lộ trình',
    },
    {
      emoji: '🤝',
      title: 'Tham gia mentoring',
      description: 'Được anh chị đi trước hướng dẫn và review bài làm của bạn.',
      href: MENTORING_URL,
      cta: 'Đến trang mentoring',
    },
    {
      emoji: '✍️',
      title: 'Đóng góp nội dung',
      description: 'Viết bài học hoặc bài tập cho các thế hệ thành viên sau.',
      href: CLUB_LINKS.contribute,
      cta: 'Xem cách đóng góp',
    },
  );
  return cards;
}
