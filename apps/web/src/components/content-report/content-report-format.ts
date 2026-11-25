import {
  CONTENT_REPORT_DESCRIPTION_MAX,
  CONTENT_REPORT_QUOTE_MAX,
  CONTENT_REPORT_STATUSES,
  type ContentReportCategory,
  type ContentReportQuery,
  type ContentReportTarget,
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

/** A small symbol per category on its chip; the text label next to it carries the meaning. */
export const CATEGORY_ICON: Record<ContentReportCategory, string> = {
  typo: 'Aa',
  wrong_knowledge: '💡',
  broken_code: '</>',
  wrong_answer: '✗',
  broken_media: '🖼',
  other: '…',
};

/** "Bài" for a lesson or an exercise, "Trang" for a page of the track. */
export function targetKindLabel(kind: ContentReportTarget): string {
  return kind === 'lesson' || kind === 'exercise' ? 'Bài' : 'Trang';
}

/** The hint in an empty "Mô tả", and the text "Chèn mẫu" adds. */
export const DESCRIPTION_PLACEHOLDER = 'Sai: …\nNên là: …';
export const DESCRIPTION_TEMPLATE = 'Sai: \nNên là: ';

/** The textarea after an edit, with the selection to restore. */
export interface TextEdit {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

/**
 * Puts `block` on lines of its own at the cursor (or in place of the selection), adding a
 * line break before or after only where the text does not already have one.
 */
function insertOnOwnLines(value: string, start: number, end: number, block: string) {
  const before = value.slice(0, start);
  const after = value.slice(end);
  const lead = before && !before.endsWith('\n') ? '\n' : '';
  const trail = after && !after.startsWith('\n') ? '\n' : '';
  return { text: `${before}${lead}${block}${trail}${after}`, offset: before.length + lead.length };
}

/**
 * "Khối code": wraps the selection in a ``` fence, or adds an empty one with the cursor
 * inside. The fence is longer than any run of backticks in the selection, so pasted
 * Markdown cannot close it. Null when the result would pass the length limit.
 */
export function insertCodeBlock(
  value: string,
  start: number,
  end: number,
  max = CONTENT_REPORT_DESCRIPTION_MAX,
): TextEdit | null {
  const code = value.slice(start, end);
  const longest = Math.max(0, ...(code.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(Math.max(3, longest + 1));
  const { text, offset } = insertOnOwnLines(value, start, end, `${fence}\n${code}\n${fence}`);
  if (text.length > max) return null;
  const codeStart = offset + fence.length + 1;
  return { value: text, selectionStart: codeStart, selectionEnd: codeStart + code.length };
}

/** "Chèn mẫu": "Sai: " and "Nên là: " lines, with the cursor after "Sai: ". */
export function insertTemplate(
  value: string,
  start: number,
  end: number,
  max = CONTENT_REPORT_DESCRIPTION_MAX,
): TextEdit | null {
  const { text, offset } = insertOnOwnLines(value, start, end, DESCRIPTION_TEMPLATE);
  if (text.length > max) return null;
  const cursor = offset + 'Sai: '.length;
  return { value: text, selectionStart: cursor, selectionEnd: cursor };
}

/** Ctrl+Enter (Cmd+Enter on a Mac) sends the form. */
export function isSubmitShortcut(e: { key: string; ctrlKey: boolean; metaKey: boolean }): boolean {
  return e.key === 'Enter' && (e.ctrlKey || e.metaKey);
}

/** The first missing field and what to say, or null when the form can be sent. */
export function missingField(
  category: string,
  description: string,
): { field: 'category' | 'description'; message: string } | null {
  if (!category) return { field: 'category', message: 'Hãy chọn loại lỗi.' };
  if (!description.trim()) return { field: 'description', message: 'Hãy ghi mô tả lỗi.' };
  return null;
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
