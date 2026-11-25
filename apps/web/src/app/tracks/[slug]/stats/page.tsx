import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  TRACK_STATS_INACTIVE_DAYS,
  TRACK_STATS_WEEKS,
  trackStatsDays,
  type ContentReportCounts,
} from '@hub/shared';
import { formatDay } from '@/components/admin/report-format';
import { openReportsHref } from '@/components/content-report/content-report-format';
import { Breadcrumbs } from '@/components/learn/Breadcrumbs';
import { ColumnChart } from '@/components/track/ColumnChart';
import {
  ChapterFunnel,
  EmptyStats,
  KpiRow,
  LessonDetail,
  PeriodPicker,
} from '@/components/track/TrackStatsSections';
import {
  FirstAttemptTable,
  InactiveTable,
  WaitingReviewTable,
} from '@/components/track/TrackStatsTables';
import { TrackTabs } from '@/components/track/TrackTabs';
import { STATS_LABEL, trackTabs } from '@/components/track/track-docs';
import {
  HIGH_DROP_KEEP,
  HIGH_DROP_MIN,
  adminReportsHref,
  bucketLabel,
  weekLabel,
  weekRange,
} from '@/components/track/track-stats-format';
import { api, getMe } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { loadTrack, loadTrackStats } from '@/lib/track';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const track = await loadTrack(slug);
  return { title: `${STATS_LABEL} · ${track.title}` };
}

/** A card with a heading; the charts and tables of the page sit in these. */
function Panel({
  id,
  title,
  description,
  children,
  className = '',
}: {
  id: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`surface min-w-0 space-y-3 rounded-xl p-4 sm:p-5 ${className}`}
      aria-labelledby={id}
    >
      <div className="space-y-1">
        <h2 id={id} className="font-semibold">
          {title}
        </h2>
        {description && <p className="muted text-sm">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * "Thống kê" of one track (/tracks/:slug/stats, learning-hub#118, redesigned in #126): for
 * admins and mentors, every track. First screen: the period picker, the headline numbers
 * against the previous period, the weekly chart and the chapter funnel. Below: progress
 * spread, waiting reviews, lessons per chapter (collapsed), hardest exercises, quiet
 * learners. With nobody enrolled, one card explains what to do instead of charts of zeros.
 * The API decides who may see it; this page only shows a message when it says no.
 */
export default async function TrackStatsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const days = trackStatsDays((await searchParams).days);
  // Load the track first: a bad slug or an archived track becomes the 404 page there.
  const track = await loadTrack(slug);
  const [stats, me] = await Promise.all([loadTrackStats(slug, days), getMe()]);
  // Reports members sent about this track (learning-hub#121); same audience as this page.
  const reports = stats
    ? await api<{ data: ContentReportCounts }>(
        `/content-reports/counts?track=${encodeURIComponent(slug)}`,
      )
        .then((r) => r.data)
        .catch(() => null)
    : null;

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
          Chỉ admin và mentor xem được thống kê track.
        </p>
      </article>
    );
  }

  const tabs = <TrackTabs tabs={trackTabs(track.slug, { ...track, canSeeStats: true }, 'stats')} />;

  if (stats.totals.enrolled === 0) {
    return (
      <article className="space-y-6 sm:space-y-8">
        {header}
        {tabs}
        <EmptyStats trackSlug={track.slug} trackTitle={track.title} />
      </article>
    );
  }

  const now = new Date(stats.generatedAt);
  const isAdmin = me?.roles.includes('admin') ?? false;
  const { totals, previous, period } = stats;

  return (
    <article className="space-y-6">
      {header}
      {tabs}

      <section className="space-y-4" aria-labelledby="stats-totals">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 id="stats-totals" className="text-lg font-semibold">
              Tổng quan {period.days} ngày
            </h2>
            <p className="muted max-w-2xl text-sm">
              {formatDay(period.from)} – {formatDay(period.to)} (tới lúc xem trang), so với{' '}
              {formatDay(previous.period.from)} – {formatDay(previous.period.to)}. Người học là tài
              khoản đã ghi danh, không tính admin và mentor. Số liệu lúc{' '}
              {formatDateTime(stats.generatedAt)}.
            </p>
          </div>
          <PeriodPicker trackSlug={track.slug} days={period.days} />
        </div>
        <KpiRow totals={totals} previous={previous.totals} days={period.days} />
        {(isAdmin || reports) && (
          <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {isAdmin && (
              <Link
                href={adminReportsHref(stats.track.slug, period)}
                className="text-brand-600 hover:underline"
              >
                Báo cáo tiến độ cùng khoảng thời gian →
              </Link>
            )}
            {reports && (
              <Link
                href={openReportsHref(stats.track.slug)}
                className="text-brand-600 hover:underline"
              >
                Báo lỗi nội dung đang mở: {reports.open}
                {reports.in_progress > 0 && ` (và ${reports.in_progress} đang xử lý)`} →
              </Link>
            )}
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          id="stats-weekly"
          title={`Theo tuần (${TRACK_STATS_WEEKS} tuần gần nhất)`}
          description="Số người ghi danh mới và số người có học (đánh dấu bài học hoặc nộp bài) mỗi tuần, tính từ thứ Hai theo giờ Việt Nam."
        >
          <ColumnChart
            label={`Ghi danh và đang học theo tuần, ${TRACK_STATS_WEEKS} tuần gần nhất`}
            series={[
              { label: 'Ghi danh', color: '--chart-1' },
              { label: 'Đang học', color: '--chart-2' },
            ]}
            columns={stats.weekly.map((w) => ({
              key: w.weekStart,
              label: weekLabel(w.weekStart),
              title: `Tuần ${weekRange(w.weekStart)}`,
              values: [w.enrolled, w.active],
            }))}
          />
        </Panel>

        <Panel
          id="stats-funnel"
          title="Học viên dừng ở chương nào"
          description={`Số người xong cả chương và đã bắt đầu chương, trên ${totals.enrolled} người ghi danh. Chỗ tụt mạnh nhất: chương mất nhiều người nhất, tính bằng số người bắt đầu chương so với chương ngay trước.`}
        >
          <ChapterFunnel modules={stats.funnel} enrolled={totals.enrolled} />
        </Panel>

        <Panel
          id="stats-progress"
          title="Phân bố tiến độ"
          description="Số người theo phần bài học và bài tập đã xong của track, lúc xem trang. Cột 100% gồm người đã xong mọi bài hoặc đã được ghi nhận hoàn thành track."
        >
          <ColumnChart
            label="Số người học theo tiến độ"
            series={[{ label: 'Người học', color: '--chart-2' }]}
            valueLabels
            columns={stats.progress.map((b) => ({
              key: `${b.from}-${b.to}`,
              label: bucketLabel(b),
              title: `Tiến độ ${bucketLabel(b)}`,
              values: [b.learners],
            }))}
          />
        </Panel>

        <Panel
          id="stats-waiting"
          title="Chờ review lâu nhất"
          description={`${totals.awaitingReview} bài đang chờ mentor.`}
        >
          <WaitingReviewTable rows={stats.hardest.waitingReviews} />
        </Panel>
      </div>

      <Panel
        id="stats-lessons"
        title="Chi tiết từng bài"
        description={`Mở một chương để xem số người xong từng bài học và bài tập. Bài học so với bài học trước, bài tập so với bài tập trước trong cùng chương (đánh dấu đã đọc bài học là tùy ý, nên không so bài tập với bài học). Nhãn “Rời đi nhiều”: mất trên ${Math.round((1 - HIGH_DROP_KEEP) * 100)}% người so với bài trước (bài trước có ít nhất ${HIGH_DROP_MIN} người).`}
      >
        <LessonDetail modules={stats.funnel} enrolled={totals.enrolled} />
      </Panel>

      <Panel id="stats-hard" title="Nộp lần đầu chưa đạt nhiều nhất">
        <FirstAttemptTable rows={stats.hardest.firstAttempt} />
      </Panel>

      <Panel
        id="stats-quiet"
        title={`Lâu không hoạt động (${stats.inactive.total})`}
        description={`Chưa xong track và không đánh dấu bài học hay nộp bài từ ${TRACK_STATS_INACTIVE_DAYS} ngày trở lên, hoặc chưa từng hoạt động sau ${TRACK_STATS_INACTIVE_DAYS} ngày ghi danh. Hỏi thăm họ xem có bị kẹt không.`}
      >
        <InactiveTable learners={stats.inactive.learners} total={stats.inactive.total} now={now} />
      </Panel>
    </article>
  );
}
