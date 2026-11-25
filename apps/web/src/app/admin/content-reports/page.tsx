import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  CONTENT_REPORT_CATEGORY_LABEL,
  CONTENT_REPORT_STATUS_LABEL,
  CONTENT_REPORT_STATUSES,
  type ContentReportList,
  type ContentReportRow,
} from '@hub/shared';
import { ContentReportActions } from '@/components/admin/ContentReportActions';
import {
  reportFiltersFromParams,
  reportFiltersSearch,
} from '@/components/content-report/content-report-format';
import { api, getMe } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

export const metadata: Metadata = { title: 'Báo lỗi nội dung' };

const FIELD = 'rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm';
const BUTTON =
  'press rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:border-brand-500';

/**
 * "Báo lỗi nội dung" for admins and mentors (learning-hub#121, INFORMATION-ARCHITECTURE §9):
 * reports members sent from content pages, filtered by track and status. Filters are a
 * plain GET form, so the URL can be shared. The API checks the roles again.
 */
export default async function ContentReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await getMe();
  if (!me || !(me.roles.includes('admin') || me.roles.includes('mentor'))) notFound();

  const query = reportFiltersFromParams(await searchParams);
  const { data } = await api<{ data: ContentReportList }>(
    `/content-reports${reportFiltersSearch(query)}`,
  );

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Báo lỗi nội dung</h1>
        <p className="muted mt-1 max-w-3xl text-sm">
          Thành viên báo lỗi từ trang bài học, bài tập và trang của lộ trình. Sửa trong repo của lộ
          trình (hoặc tạo issue ở đó), rồi đổi sang &quot;Đã sửa&quot; hoặc &quot;Không sửa&quot;:
          người báo nhận thông báo. Issue trên GitHub không ghi tên người báo.
        </p>
      </header>

      <nav aria-label="Lọc theo trạng thái" className="flex flex-wrap gap-2 text-sm">
        <Link
          href={`/admin/content-reports${reportFiltersSearch({ track: query.track })}`}
          className={`${BUTTON} ${!query.status ? 'border-brand-500 font-medium' : ''}`}
        >
          Tất cả
        </Link>
        {CONTENT_REPORT_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/content-reports${reportFiltersSearch({ track: query.track, status: s })}`}
            className={`${BUTTON} ${query.status === s ? 'border-brand-500 font-medium' : ''}`}
          >
            {CONTENT_REPORT_STATUS_LABEL[s]} ({data.counts[s]})
          </Link>
        ))}
      </nav>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Lộ trình</span>
          <select name="track" defaultValue={query.track ?? ''} className={FIELD}>
            <option value="">Tất cả</option>
            {data.options.tracks.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
        {query.status && <input type="hidden" name="status" value={query.status} />}
        <button className={BUTTON}>Xem</button>
      </form>

      {data.reports.length === 0 ? (
        <p className="muted text-sm italic">Không có báo lỗi nào trong bộ lọc này.</p>
      ) : (
        <ul className="space-y-4">
          {data.reports.map((r) => (
            <li key={r.id}>
              <ReportCard report={r} canCreateIssue={data.canCreateIssues} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const STATUS_CLASS: Record<ContentReportRow['status'], string> = {
  open: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  in_progress: 'bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  resolved: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  dismissed: 'bg-[var(--border)] text-[var(--muted)]',
};

function ReportCard({
  report: r,
  canCreateIssue,
}: {
  report: ContentReportRow;
  canCreateIssue: boolean;
}) {
  return (
    <article className="surface space-y-3 rounded-xl p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_CLASS[r.status]}`}>
          {CONTENT_REPORT_STATUS_LABEL[r.status]}
        </span>
        <span className="font-medium">{CONTENT_REPORT_CATEGORY_LABEL[r.category]}</span>
        <span className="muted">·</span>
        <Link href={r.target.link} className="min-w-0 font-medium hover:underline">
          {r.target.title}
        </Link>
        <span className="muted">({r.track.title})</span>
      </div>
      <p className="text-sm break-words whitespace-pre-line">{r.description}</p>
      {r.quote && (
        <blockquote className="muted border-l-2 border-[var(--border)] pl-3 text-sm break-words whitespace-pre-line">
          {r.quote}
        </blockquote>
      )}
      <p className="muted text-xs">
        @{r.reporter.githubLogin} · {formatDateTime(r.createdAt)}
        {r.commitSha && (
          <>
            {' '}
            · commit <code>{r.commitSha.slice(0, 7)}</code>
          </>
        )}
        {r.handledBy && <> · xử lý: @{r.handledBy.githubLogin}</>}
      </p>
      <ContentReportActions report={r} canCreateIssue={canCreateIssue} />
    </article>
  );
}
