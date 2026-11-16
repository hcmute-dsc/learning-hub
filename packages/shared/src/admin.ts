import { z } from 'zod';

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
