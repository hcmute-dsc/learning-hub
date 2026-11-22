import type { ProgressReport } from '@hub/shared';
import { toCsv } from './csv';
import { vietnamDateTime, vietnamDay } from './period';

/**
 * The two CSV exports of /admin/reports, same columns as the page. Every row repeats the
 * period so weekly files can be pasted under each other. No email, no user id (learning-hub#34,
 * SECURITY): only the GitHub login, or an alias when anonymized.
 */

const cohortLabel = (cohort: string | null) => cohort ?? '(chưa gắn đợt)';
const day = (iso: string | null) => (iso ? vietnamDay(new Date(iso)) : '');

export function summaryCsv(report: ProgressReport): string {
  const { from, to } = report.period;
  const header = [
    'Từ ngày',
    'Đến ngày',
    'Track',
    'Đợt',
    'Người ghi danh',
    'Người hoạt động',
    'Bài học xong trong kỳ',
    'Bài tập xong trong kỳ',
    'Người có ≥ 5 bài tập',
    'Tỉ lệ ≥ 5 bài tập (%)',
    'Hoàn thành track',
    'Tỉ lệ hoàn thành (%)',
    'Bài chờ review (lúc xuất)',
    'Review xong trong kỳ',
    'Review trung vị (giờ)',
    'Review lâu nhất (giờ)',
    'Mentor có review',
  ];
  const rows = [
    ...report.groups.map((g) => ({ track: g.track.title, cohort: cohortLabel(g.cohort), s: g })),
    { track: 'Tổng', cohort: '', s: report.total },
  ].map(({ track, cohort, s }) => [
    from,
    to,
    track,
    cohort,
    s.enrolled,
    s.active,
    s.lessonsCompleted,
    s.exercisesCompleted,
    s.atLeastFive,
    s.atLeastFiveRate,
    s.completedTrack,
    s.completionRate,
    s.awaitingReview,
    s.reviewsDone,
    s.reviewHoursMedian,
    s.reviewHoursMax,
    s.reviewers,
  ]);
  return toCsv(header, rows);
}

export function membersCsv(report: ProgressReport): string {
  const { from, to } = report.period;
  const header = [
    'Từ ngày',
    'Đến ngày',
    'GitHub',
    'Track',
    'Đợt',
    'Ngày ghi danh',
    'Bài học xong trong kỳ',
    'Bài học xong (tổng)',
    'Số bài học',
    'Bài tập xong trong kỳ',
    'Bài tập xong (tổng)',
    'Số bài tập',
    'Bài chờ review (lúc xuất)',
    'Hoạt động gần nhất',
    'Ngày hoàn thành track',
  ];
  const rows = report.members.map((m) => [
    from,
    to,
    m.githubLogin,
    m.trackSlug,
    cohortLabel(m.cohort),
    day(m.enrolledAt),
    m.lessonsInPeriod,
    m.lessonsDone,
    m.lessonsTotal,
    m.exercisesInPeriod,
    m.exercisesDone,
    m.exercisesTotal,
    m.awaitingReview,
    m.lastActiveAt ? vietnamDateTime(new Date(m.lastActiveAt)) : '',
    day(m.completedAt),
  ]);
  return toCsv(header, rows);
}

/** "bao-cao-thanh-vien_sql-30-days_2026-11-23_2026-11-29.csv" (ASCII only, safe in headers). */
export function exportFileName(table: 'summary' | 'members', report: ProgressReport): string {
  const what = table === 'summary' ? 'bao-cao-tong-hop' : 'bao-cao-thanh-vien';
  const track = report.filters.track ?? 'tat-ca';
  return `${what}_${track}_${report.period.from}_${report.period.to}.csv`;
}
