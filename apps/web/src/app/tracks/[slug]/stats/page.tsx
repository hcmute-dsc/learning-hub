import type { Metadata } from 'next';
import Link from 'next/link';
import { TRACK_STATS_INACTIVE_DAYS, TRACK_STATS_WEEKS } from '@hub/shared';
import { formatDay } from '@/components/admin/report-format';
import { Breadcrumbs } from '@/components/learn/Breadcrumbs';
import {
  FirstAttemptTable,
  Funnel,
  InactiveTable,
  SummaryCards,
  WaitingReviewTable,
  WeeklyChart,
} from '@/components/track/TrackStatsSections';
import { TrackTabs } from '@/components/track/TrackTabs';
import { STATS_LABEL, trackTabs } from '@/components/track/track-docs';
import { adminReportsHref } from '@/components/track/track-stats-format';
import { getMe } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { loadTrack, loadTrackStats } from '@/lib/track';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const track = await loadTrack(slug);
  return { title: `${STATS_LABEL} · ${track.title}` };
}

/**
 * "Thống kê" of one track (/tracks/:slug/stats, learning-hub#118): for admins and the
 * track's mentors. Totals, where learners stop (funnel), the hardest exercises, the last
 * weeks, and who has gone quiet. The API decides who may see it; this page only shows a
 * message when it says no.
 */
export default async function TrackStatsPage({ params }: Params) {
  const { slug } = await params;
  // Load the track first: a bad slug or an archived track becomes the 404 page there.
  const track = await loadTrack(slug);
  const [stats, me] = await Promise.all([loadTrackStats(slug), getMe()]);

  const header = (
    <header>
      <Breadcrumbs
        items={[
          { label: 'Lộ trình', href: '/tracks' },
          { label: track.title, href: `/tracks/${track.slug}` },
          { label: STATS_LABEL },
        ]}
      />
      <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">{STATS_LABEL}</h1>
    </header>
  );

  if (!stats) {
    return (
      <article className="space-y-6">
        {header}
        <p role="alert" className="surface rounded-xl p-5 text-sm">
          Chỉ admin và mentor của track này xem được thống kê.
        </p>
      </article>
    );
  }

  const now = new Date(stats.generatedAt);
  const isAdmin = me?.roles.includes('admin') ?? false;

  return (
    <article className="space-y-6 sm:space-y-8">
      {header}
      <TrackTabs tabs={trackTabs(track.slug, { ...track, canSeeStats: true }, 'stats')} />

      <section className="space-y-3" aria-labelledby="stats-totals">
        <div className="space-y-1">
          <h2 id="stats-totals" className="text-lg font-semibold">
            Tổng quan
          </h2>
          <p className="muted max-w-3xl text-sm">
            Người học là tài khoản đã ghi danh, không tính admin và mentor. &quot;Đang học&quot; và
            review tính trong {formatDay(stats.period.from)} – {formatDay(stats.period.to)}. Số liệu
            lúc {formatDateTime(stats.generatedAt)}.
          </p>
          {isAdmin && (
            <p className="text-sm">
              <Link
                href={adminReportsHref(stats.track.slug, stats.period)}
                className="text-brand-600 hover:underline"
              >
                Xem báo cáo tiến độ của track này →
              </Link>
            </p>
          )}
        </div>
        <SummaryCards totals={stats.totals} />
      </section>

      <section className="surface space-y-3 rounded-xl p-4 sm:p-5" aria-labelledby="stats-funnel">
        <h2 id="stats-funnel" className="font-semibold">
          Học viên dừng ở đâu
        </h2>
        <p className="muted text-sm">
          Số người đã xong từng chương, bài học và bài tập, trên {stats.totals.enrolled} người ghi
          danh. Thanh tụt mạnh là chỗ nhiều người dừng lại.
        </p>
        <Funnel modules={stats.funnel} enrolled={stats.totals.enrolled} />
      </section>

      <section className="surface space-y-3 rounded-xl p-4 sm:p-5" aria-labelledby="stats-weekly">
        <h2 id="stats-weekly" className="font-semibold">
          Theo tuần ({TRACK_STATS_WEEKS} tuần gần nhất)
        </h2>
        <WeeklyChart weeks={stats.weekly} />
      </section>

      <section className="surface space-y-4 rounded-xl p-4 sm:p-5" aria-labelledby="stats-hard">
        <h2 id="stats-hard" className="font-semibold">
          Bài tập khó
        </h2>
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Nộp lần đầu chưa đạt nhiều nhất</h3>
          <FirstAttemptTable rows={stats.hardest.firstAttempt} />
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Chờ review lâu nhất</h3>
          <WaitingReviewTable rows={stats.hardest.waitingReviews} />
        </div>
      </section>

      <section className="surface space-y-3 rounded-xl p-4 sm:p-5" aria-labelledby="stats-quiet">
        <h2 id="stats-quiet" className="font-semibold">
          Lâu không hoạt động ({stats.inactive.total})
        </h2>
        <p className="muted text-sm">
          Chưa xong track và không đánh dấu bài học hay nộp bài từ {TRACK_STATS_INACTIVE_DAYS} ngày
          trở lên. Hỏi thăm họ xem có bị kẹt không.
        </p>
        <InactiveTable learners={stats.inactive.learners} total={stats.inactive.total} now={now} />
      </section>
    </article>
  );
}
