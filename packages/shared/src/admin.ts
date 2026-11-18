import { z } from 'zod';
import type { Role, UserStatus } from './index';

/**
 * API contract for the admin "Thành viên" page (club email list + pending accounts).
 * Every response body is `{ data: ... }`.
 */

/** Most emails one request may carry (a whole intake list fits easily). */
export const MAX_APPROVED_EMAILS_PER_REQUEST = 5000;

/** PUT /api/v1/admin/approved-emails  (admin only) */
export const approvedEmailsUpdateSchema = z
  .object({
    emails: z.array(z.string().trim().email()).min(1).max(MAX_APPROVED_EMAILS_PER_REQUEST),
    /** `append` (default) adds to the list; `replace` makes this the whole list */
    mode: z.enum(['append', 'replace']).default('append'),
    note: z.string().trim().max(200).optional(),
  })
  .strict();
export type ApprovedEmailsUpdateInput = z.input<typeof approvedEmailsUpdateSchema>;

/** → { data: ApprovedEmailsUpdateResult } */
export interface ApprovedEmailsUpdateResult {
  /** emails on the list after the update */
  total: number;
  /** pending accounts that became active because their email is now on the list */
  activated: number;
}

/** GET /api/v1/admin/approved-emails  (admin only) → { data: ApprovedEmailList } */
export interface ApprovedEmailList {
  total: number;
  emails: { email: string; note: string | null; createdAt: string }[];
}

/** One account in the admin "Tất cả tài khoản" table. */
export interface AdminUserRow {
  id: string;
  githubLogin: string;
  displayName: string;
  avatarUrl: string | null;
  /** GitHub email kept at sign-in (the one that matched the club list when there was one) */
  email: string | null;
  status: UserStatus;
  roles: Role[];
  /** true when `email` is on the club email list (approved_emails) */
  onEmailList: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

/** GET /api/v1/admin/users  (admin only: contains emails) → { data: AdminUserRow[] } */
export const ADMIN_USERS_LIMIT = 2000;

// PUT  /api/v1/admin/users/:id/roles       { roles: Role[] } → 204 (admin; `member` is always kept)
// POST /api/v1/admin/users/:id/suspend     → 204 (admin; signs the account out everywhere)
// POST /api/v1/admin/users/:id/reactivate  → 204 (admin)

// ---------- Content versions (/admin/content) ----------

export const CONTENT_VERSION_STATUSES = ['draft', 'published', 'superseded', 'rejected'] as const;
export type ContentVersionStatus = (typeof CONTENT_VERSION_STATUSES)[number];

export const CONTENT_ITEM_KINDS = ['track', 'module', 'lesson', 'exercise'] as const;
export type ContentItemKind = (typeof CONTENT_ITEM_KINDS)[number];

export interface ContentDiffCount {
  added: number;
  changed: number;
  removed: number;
  unchanged: number;
}

/** `summary` of a content version, as written by the content module at sync/publish. */
export interface ContentVersionSummary {
  counts?: Record<'tracks' | 'modules' | 'lessons' | 'exercises', number>;
  /** null when the content was invalid (nothing to compare) */
  diff?: Record<ContentItemKind, ContentDiffCount> | null;
  issueCount?: number;
  issues?: { path: string; message: string }[];
  /** set when the version was published */
  appliedAt?: string;
}

/** Who did something, as shown in admin tables (never the email). */
export interface UserRef {
  id: string;
  githubLogin: string;
  displayName: string;
  avatarUrl: string | null;
}

/** GET /api/v1/admin/content/versions[/:id]  (content_maintainer + admin) → { data } */
export interface ContentVersionView {
  id: string;
  /** `owner/repo` for GitHub, a folder path for local development */
  sourceRepo: string;
  commitSha: string;
  status: ContentVersionStatus;
  summary: ContentVersionSummary;
  createdAt: string;
  publishedAt: string | null;
  syncedBy: UserRef | null;
  publishedBy: UserRef | null;
}

// ---------- Audit log (/admin/audit) ----------

/** GET /api/v1/admin/audit?cursor=&action=&limit=  (admin only), newest first */
export const auditQuerySchema = z
  .object({
    /** opaque: the `page.nextCursor` of the previous response */
    cursor: z
      .string()
      .regex(/^\d{1,19}$/)
      .optional(),
    action: z
      .string()
      .regex(/^[a-z_.]{1,60}$/)
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
export type AuditQuery = z.infer<typeof auditQuerySchema>;

export interface AuditLogRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  /** null for actions done by the system (e.g. automatic approval at sign-in) */
  actor: UserRef | null;
  /** the account acted on, when `entityType` is `user` */
  target: UserRef | null;
  /** counts and codes only: the email list never goes into the audit log (SECURITY §1) */
  metadata: Record<string, unknown>;
  createdAt: string;
}

/** → { data: AuditLogRow[], page: AuditPage } */
export interface AuditPage {
  nextCursor: string | null;
  limit: number;
}

/** GET /api/v1/admin/audit/actions  (admin only) → { data: string[] } — for the filter */

// ---------- Overview (/admin) ----------

/**
 * GET /api/v1/admin/overview  (admin only) → { data: AdminOverview }
 * Counts only: no names or emails, so the page can never leak personal data (SECURITY §1).
 */
export interface AdminOverview {
  members: Record<UserStatus, number>;
  content: {
    /** the version members see now, or null before the first publish */
    published: { id: string; commitSha: string; publishedAt: string | null } | null;
    /** synced versions waiting for a maintainer to publish or reject */
    drafts: number;
  };
  reviews: {
    waiting: number;
    /** the submission waiting longest, or null when the queue is empty */
    oldest: { submittedAt: string; hoursWaiting: number; overTarget: boolean } | null;
    targetHours: number;
  };
  /** the last `days` days, counted from now */
  activity: {
    days: number;
    /** members who signed in at least once */
    signedIn: number;
    submissions: number;
    /** rows written to the audit log (Nhật ký) */
    adminActions: number;
  };
}
