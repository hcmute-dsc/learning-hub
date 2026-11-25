import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Me, ProgressReport, ReportQuery } from '@hub/shared';
import {
  cohortOptions,
  formatDay,
  reportPresets,
  reportQueryFromParams,
  reportSearch,
} from '@/components/admin/report-format';
import { GroupTable, MemberTable, ReportTotals } from '@/components/admin/ReportTables';
import { trackStatsHref } from '@/components/track/track-docs';
import { api, ApiError } from '@/lib/api';

export const metadata: Metadata = { title: 'Báo cáo tiến độ' };

const FIELD = 'rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm';
const BUTTON =
  'press rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:border-brand-500';

/** The report, or the API's message when the period is not valid (422). */
async function loadReport(query: ReportQuery): Promise<ProgressReport | string> {
  try {
    const { data } = await api<{ data: ProgressReport }>(`/admin/reports${reportSearch(query)}`);
    return data;
  } catch (e) {
    if (e instanceof ApiError && e.problem.status === 422) {
      return 'Khoảng ngày không hợp lệ: ngày bắt đầu phải trước ngày kết thúc, tối đa 366 ngày.';
    }
    if (e instanceof ApiError && e.problem.status === 404) return 'Không tìm thấy track này.';
    throw e;
  }
}

/**
 * Admin "Báo cáo" (learning-hub#34, INFORMATION-ARCHITECTURE §9): progress per track and
 * cohort for a period, the per-member table for the trial report (TRIAL-P0), and CSV
 * downloads of both. Filters are a plain GET form, so the URL can be shared.
 */
export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { data: me } = await api<{ data: Me }>('/auth/me');
  if (!me.roles.includes('admin')) notFound();

  const query = reportQueryFromParams(await searchParams);
  const report = await loadReport(query);
  const shown = typeof report === 'string' ? null : report;
  const filters = shown
    ? { from: shown.period.from, to: shown.period.to, ...shown.filters }
    : { ...query, track: query.track ?? null, cohort: query.cohort ?? null };

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Báo cáo tiến độ</h1>
        <p className="muted mt-1 max-w-3xl text-sm">
          Tiến độ người học theo track và đợt trong một khoảng ngày (giờ Việt Nam), cùng cách tính
          với số liệu tuần của đợt dùng thử (M1–M8). Người học là tài khoản đã ghi danh track, không
          tính admin và mentor. Báo cáo không có email; tải CSV được ghi vào Nhật ký.
        </p>
      </header>

      <section className="surface space-y-3 rounded-xl p-5">
        <nav aria-label="Khoảng ngày nhanh" className="flex flex-wrap gap-2 text-sm">
          {reportPresets(new Date()).map((p) => (
            <Link
              key={p.label}
              href={`/admin/reports${reportSearch({ ...filters, track: filters.track ?? undefined, cohort: filters.cohort ?? undefined, from: p.from, to: p.to })}`}
              className={`${BUTTON} ${p.from === filters.from && p.to === filters.to ? 'border-brand-500 font-medium' : ''}`}
            >
              {p.label}
            </Link>
          ))}
        </nav>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Từ ngày</span>
            <input type="date" name="from" defaultValue={filters.from} className={FIELD} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Đến ngày</span>
            <input type="date" name="to" defaultValue={filters.to} className={FIELD} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Track</span>
            <select name="track" defaultValue={filters.track ?? ''} className={FIELD}>
              <option value="">Tất cả</option>
              {shown?.options.tracks.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Đợt</span>
            <select name="cohort" defaultValue={filters.cohort ?? ''} className={FIELD}>
              <option value="">Tất cả</option>
              {cohortOptions(shown?.options.cohorts ?? []).map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <button className={BUTTON}>Xem</button>
        </form>
      </section>

      {!shown ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {report as string}
        </p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">
              {formatDay(shown.period.from)} – {formatDay(shown.period.to)}
            </h2>
            <ReportTotals total={shown.total} />
            {shown.filters.track && (
              <p className="text-sm">
                <Link
                  href={trackStatsHref(shown.filters.track)}
                  className="text-brand-600 hover:underline"
                >
                  Thống kê theo chương, bài và tuần của track này →
                </Link>
              </p>
            )}
          </section>

          <section className="surface space-y-3 rounded-xl p-5">
            <h2 className="font-semibold">Theo track và đợt</h2>
            {shown.groups.length === 0 ? (
              <p className="muted text-sm italic">Chưa có ai ghi danh trong bộ lọc này.</p>
            ) : (
              <GroupTable groups={shown.groups} />
            )}
          </section>

          <section className="surface space-y-3 rounded-xl p-5">
            <h2 className="font-semibold">Từng người học ({shown.members.length})</h2>
            <p className="muted text-sm">
              &quot;Kỳ&quot; là số xong trong khoảng ngày đã chọn, &quot;tổng&quot; là tính tới cuối
              khoảng đó. Bài tập tự đánh giá tính là xong khi nộp.
            </p>
            {shown.members.length > 0 && <MemberTable members={shown.members} />}
          </section>

          <ExportForm report={shown} />
        </>
      )}
    </section>
  );
}

/** A GET form straight to the API: the browser downloads the file, the page stays. */
function ExportForm({ report }: { report: ProgressReport }) {
  const hidden = { from: report.period.from, to: report.period.to, ...report.filters };
  return (
    <section className="surface space-y-3 rounded-xl p-5">
      <h2 className="font-semibold">Tải CSV</h2>
      <p className="muted max-w-3xl text-sm">
        Cùng số liệu và bộ lọc như trên, mở được bằng Excel hoặc Google Sheets (UTF-8). Chỉ có
        GitHub login, không có email. Nếu gửi file ra ngoài Ban chủ nhiệm (ví dụ dán số vào issue
        công khai), chọn ẩn danh.
      </p>
      <form
        method="get"
        action="/api/v1/admin/reports/export"
        className="flex flex-wrap items-center gap-3"
      >
        {Object.entries(hidden).map(([name, value]) =>
          value ? <input key={name} type="hidden" name={name} value={value} /> : null,
        )}
        <label className="flex items-center gap-1.5 text-sm">
          <input type="radio" name="table" value="summary" defaultChecked /> Bảng tổng hợp
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="radio" name="table" value="members" /> Bảng từng người học
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" name="anonymize" value="true" /> Ẩn danh (Người học 001…)
        </label>
        <button className={BUTTON}>Tải CSV</button>
      </form>
    </section>
  );
}
