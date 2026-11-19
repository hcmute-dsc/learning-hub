import { z } from 'zod';

/**
 * API contract for track completion certificates (PRD F19, learning-hub#47).
 * Every response body is `{ data: ... }`.
 *
 * A certificate is issued once, when an enrollment is first stored as completed (every
 * active lesson and exercise of the track done, see apps/api learning/progress.ts).
 * Its public page shows the name, track, dates and content commit; never an email.
 */

/**
 * Certificate codes: 24 characters of lower-case base32 (a–z, 2–7), 120 random bits.
 * Long enough that nobody can guess another member's link, short enough to read out.
 */
export const CERTIFICATE_CODE = /^[a-z2-7]{24}$/;

export const CERTIFICATE_STATUSES = ['valid', 'revoked'] as const;
export type CertificateStatus = (typeof CERTIFICATE_STATUSES)[number];

/** GET /api/v1/certificates/:code (public, no sign-in) → { data: CertificateView } */
export interface CertificateView {
  code: string;
  /** the member's display name when the certificate was issued */
  recipientName: string;
  track: { slug: string; title: string };
  /** when the last item of the track was done (ISO) */
  completedAt: string;
  issuedAt: string;
  /** the track content the member finished: its repo and commit */
  content: { repo: string; commitSha: string };
  status: CertificateStatus;
  /** set when status is `revoked`; the reason stays admin-only */
  revokedAt: string | null;
}

/** GET /api/v1/me/certificates → { data: MyCertificate[] } */
export interface MyCertificate extends CertificateView {
  /** true when the member hid it from their profile; the public link still works */
  hidden: boolean;
}

/** PATCH /api/v1/me/certificates/:code → { data: MyCertificate } */
export const certificateVisibilitySchema = z.object({ hidden: z.boolean() }).strict();
export type CertificateVisibilityInput = z.infer<typeof certificateVisibilitySchema>;

/** GET /api/v1/admin/certificates (admin) → { data: AdminCertificateRow[] } */
export interface AdminCertificateRow extends MyCertificate {
  githubLogin: string;
  revokeReason: string | null;
}

/** Most certificates the admin list returns, newest first. */
export const ADMIN_CERTIFICATES_LIMIT = 200;

export const REVOKE_REASON_MAX = 280;

/** POST /api/v1/admin/certificates/:code/revoke (admin) → { data: AdminCertificateRow } */
export const certificateRevokeSchema = z
  .object({ reason: z.string().trim().min(3).max(REVOKE_REASON_MAX) })
  .strict();
export type CertificateRevokeInput = z.infer<typeof certificateRevokeSchema>;
