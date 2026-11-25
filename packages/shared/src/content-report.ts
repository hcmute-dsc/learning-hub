import { z } from 'zod';
import { TRACK_SLUG_PATTERN } from './review';

/**
 * "Báo lỗi nội dung" (learning-hub#121): a member reports a mistake on a lesson, an
 * exercise or a track page; admins and mentors handle it on /admin/content-reports and may
 * turn it into an issue in the track repo. Table `content_reports` (DATABASE.md).
 */

export const CONTENT_REPORT_TARGETS = ['lesson', 'exercise', 'track_page', 'glossary'] as const;
export type ContentReportTarget = (typeof CONTENT_REPORT_TARGETS)[number];

export const CONTENT_REPORT_CATEGORIES = [
  'typo',
  'wrong_knowledge',
  'broken_code',
  'wrong_answer',
  'broken_media',
  'other',
] as const;
export type ContentReportCategory = (typeof CONTENT_REPORT_CATEGORIES)[number];

export const CONTENT_REPORT_CATEGORY_LABEL: Record<ContentReportCategory, string> = {
  typo: 'Chính tả, diễn đạt',
  wrong_knowledge: 'Sai kiến thức',
  broken_code: 'Lệnh hoặc code không chạy',
  wrong_answer: 'Đáp án sai',
  broken_media: 'Ảnh, sơ đồ hoặc link hỏng',
  other: 'Khác',
};

export const CONTENT_REPORT_STATUSES = ['open', 'in_progress', 'resolved', 'dismissed'] as const;
export type ContentReportStatus = (typeof CONTENT_REPORT_STATUSES)[number];

export const CONTENT_REPORT_STATUS_LABEL: Record<ContentReportStatus, string> = {
  open: 'Mới',
  in_progress: 'Đang xử lý',
  resolved: 'Đã sửa',
  dismissed: 'Không sửa',
};

export const CONTENT_REPORT_DESCRIPTION_MAX = 2000;
export const CONTENT_REPORT_QUOTE_MAX = 500;
export const CONTENT_REPORT_NOTE_MAX = 2000;
/** Reports one member may send in 24 hours. */
export const CONTENT_REPORT_DAILY_LIMIT = 10;

const uuid = z.string().uuid();

/** What the report is about: a lesson or exercise by id, or a page of a track. */
export const contentReportTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('lesson'), id: uuid }).strict(),
  z.object({ kind: z.literal('exercise'), id: uuid }).strict(),
  z
    .object({
      kind: z.literal('track_page'),
      track: z.string().max(80).regex(TRACK_SLUG_PATTERN),
      page: z.enum(['setup', 'resources']),
    })
    .strict(),
  z
    .object({ kind: z.literal('glossary'), track: z.string().max(80).regex(TRACK_SLUG_PATTERN) })
    .strict(),
]);
export type ContentReportTargetInput = z.infer<typeof contentReportTargetSchema>;

/** POST /api/v1/content-reports (any signed-in member) → 201 { data: { id } } */
export const createContentReportSchema = z
  .object({
    target: contentReportTargetSchema,
    category: z.enum(CONTENT_REPORT_CATEGORIES),
    description: z
      .string()
      .trim()
      .min(1, 'Hãy ghi lỗi ở đâu, sai thế nào')
      .max(CONTENT_REPORT_DESCRIPTION_MAX),
    /** the wrong text, copied from the page */
    quote: z
      .string()
      .trim()
      .max(CONTENT_REPORT_QUOTE_MAX)
      .optional()
      .transform((v) => v || undefined),
  })
  .strict();
export type CreateContentReportInput = z.infer<typeof createContentReportSchema>;

/** GET /api/v1/content-reports?track=&status= (admins and mentors) */
export const contentReportQuerySchema = z
  .object({
    track: z.string().max(80).regex(TRACK_SLUG_PATTERN).optional(),
    status: z.enum(CONTENT_REPORT_STATUSES).optional(),
  })
  .strict();
export type ContentReportQuery = z.infer<typeof contentReportQuerySchema>;

/** GET /api/v1/content-reports/counts?track= (admins and mentors) */
export const contentReportCountsQuerySchema = z
  .object({ track: z.string().max(80).regex(TRACK_SLUG_PATTERN).optional() })
  .strict();

/** PATCH /api/v1/content-reports/:id (admins and mentors): at least one field */
export const updateContentReportSchema = z
  .object({
    status: z.enum(CONTENT_REPORT_STATUSES).optional(),
    /** empty string clears the note */
    staffNote: z.string().trim().max(CONTENT_REPORT_NOTE_MAX).optional(),
    /** `updatedAt` of the row the staff member saw; another change since then → 409 */
    updatedAt: z.string().datetime(),
  })
  .strict()
  .refine((v) => v.status !== undefined || v.staffNote !== undefined, {
    message: 'Gửi status hoặc staffNote',
  });
export type UpdateContentReportInput = z.infer<typeof updateContentReportSchema>;

export type ContentReportCounts = Record<ContentReportStatus, number>;

/** One report on the staff page. Only the reporter's GitHub login, never an email. */
export interface ContentReportRow {
  id: string;
  track: { slug: string; title: string };
  target: {
    kind: ContentReportTarget;
    /** lesson/exercise id, or the page: setup, resources, glossary */
    ref: string;
    title: string;
    /** path inside the web app */
    link: string;
  };
  commitSha: string | null;
  category: ContentReportCategory;
  description: string;
  quote: string | null;
  status: ContentReportStatus;
  reporter: { githubLogin: string };
  handledBy: { githubLogin: string } | null;
  staffNote: string | null;
  githubIssueUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/** GET /api/v1/content-reports → { data: ContentReportList } */
export interface ContentReportList {
  filters: { track: string | null; status: ContentReportStatus | null };
  /** every track, archived ones last (their old reports stay reachable) */
  options: { tracks: { slug: string; title: string; archived: boolean }[] };
  /** for the filters' track (all tracks when none), every status */
  counts: ContentReportCounts;
  /** "Tạo issue trên GitHub" works (the API has a token for it) */
  canCreateIssues: boolean;
  /** newest first, at most 200 */
  reports: ContentReportRow[];
}
