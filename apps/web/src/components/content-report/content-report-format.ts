import {
  CONTENT_REPORT_QUOTE_MAX,
  CONTENT_REPORT_STATUSES,
  type ContentReportQuery,
  type ContentReportStatus,
  type ProblemDetails,
} from '@hub/shared';

/** Pure helpers for "Báo lỗi nội dung" (learning-hub#121), tested in content-report-format.test.ts. */

/**
 * The text the member selected on the page, as the form's "Đoạn trích": one line per line
 * of the selection, trimmed, at most CONTENT_REPORT_QUOTE_MAX characters.
 */
export function quoteFromSelection(selection: string | null | undefined): string {
  if (!selection) return '';
  const text = selection
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
  return text.slice(0, CONTENT_REPORT_QUOTE_MAX);
}

/** What to tell the member when sending failed. */
export function sendErrorText(problem: Pick<ProblemDetails, 'status' | 'title'>): string {
  // The daily limit's message is Vietnamese and says what to do; the per-IP limit's is not.
  if (problem.status === 429) {
    return problem.title.startsWith('Bạn đã gửi')
      ? problem.title
      : 'Bạn gửi quá nhanh. Đợi một phút rồi thử lại.';
  }
  if (problem.status === 401) return 'Phiên đăng nhập đã hết, hãy đăng nhập lại.';
  if (problem.status === 422) return 'Hãy chọn loại lỗi và ghi mô tả (tối đa 2000 ký tự).';
  if (problem.status === 404) return 'Không tìm thấy bài này nữa. Tải lại trang rồi thử lại.';
  if (problem.status === 0) return problem.title;
  return 'Chưa gửi được. Thử lại sau ít phút.';
}

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || '';

/** Filters of /admin/content-reports from the URL; bad values fall back to "all". */
export function reportFiltersFromParams(params: SearchParams): ContentReportQuery {
  const track = one(params.track);
  const status = one(params.status);
  return {
    ...(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(track) && track.length <= 80 ? { track } : {}),
    ...((CONTENT_REPORT_STATUSES as readonly string[]).includes(status)
      ? { status: status as ContentReportStatus }
      : {}),
  };
}

/** "?track=…&status=…" for links and the API; empty values are left out. */
export function reportFiltersSearch(query: ContentReportQuery): string {
  const params = new URLSearchParams();
  if (query.track) params.set('track', query.track);
  if (query.status) params.set('status', query.status);
  const text = params.toString();
  return text ? `?${text}` : '';
}

/** The staff list for one track's open reports (link from the track statistics page). */
export function openReportsHref(trackSlug: string): string {
  return `/admin/content-reports${reportFiltersSearch({ track: trackSlug, status: 'open' })}`;
}

/** Status choices a staff member may pick from `from` (same rule as the API's canMoveTo). */
export function nextStatuses(from: ContentReportStatus): ContentReportStatus[] {
  switch (from) {
    case 'open':
      return ['in_progress', 'resolved', 'dismissed'];
    case 'in_progress':
      return ['open', 'resolved', 'dismissed'];
    default:
      return ['open'];
  }
}
