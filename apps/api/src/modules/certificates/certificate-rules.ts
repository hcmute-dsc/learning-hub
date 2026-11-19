import {
  CERTIFICATE_CODE,
  type AdminCertificateRow,
  type CertificateView,
  type MyCertificate,
} from '@hub/shared';

/**
 * Certificate rules without a database (CONTRIBUTING rule 3), tested in
 * certificate-rules.spec.ts. The service loads rows, these decide and shape.
 */

export interface CertificateRow {
  id: string;
  code: string;
  userId: string;
  trackId: string;
  recipientName: string;
  trackSlug: string;
  trackTitle: string;
  contentRepo: string;
  commitSha: string;
  completedAt: Date;
  issuedAt: Date;
  hidden: boolean;
  revokedAt: Date | null;
  revokedBy: string | null;
  revokeReason: string | null;
}

const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';

/** Random bytes a code needs: 15 bytes = 120 bits = 24 base32 characters. */
export const CODE_BYTES = 15;

/**
 * The code in /certificates/:code, from CODE_BYTES random bytes (crypto.randomBytes).
 * Lower-case base32 has no 0/1/8/9, so a code read aloud or typed is hard to get wrong.
 */
export function certificateCode(bytes: Uint8Array): string {
  if (bytes.length !== CODE_BYTES) throw new Error(`certificate code needs ${CODE_BYTES} bytes`);
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1; // keep only the unused bits, so `value` never overflows
  }
  return out;
}

/** Checked before any database read, so a malformed link is a 404 at once. */
export const isCertificateCode = (code: string): boolean => CERTIFICATE_CODE.test(code);

/** What anyone with the link sees. No email, no user id, no revoke reason (SECURITY §1). */
export function toCertificateView(row: CertificateRow): CertificateView {
  return {
    code: row.code,
    recipientName: row.recipientName,
    track: { slug: row.trackSlug, title: row.trackTitle },
    completedAt: row.completedAt.toISOString(),
    issuedAt: row.issuedAt.toISOString(),
    content: { repo: row.contentRepo, commitSha: row.commitSha },
    status: row.revokedAt ? 'revoked' : 'valid',
    revokedAt: row.revokedAt?.toISOString() ?? null,
  };
}

export function toMyCertificate(row: CertificateRow): MyCertificate {
  return { ...toCertificateView(row), hidden: row.hidden };
}

export function toAdminRow(row: CertificateRow, githubLogin: string): AdminCertificateRow {
  return { ...toMyCertificate(row), githubLogin, revokeReason: row.revokeReason };
}

/** Shown on the member's profile: not hidden by the member and not revoked. */
export const shownOnProfile = (row: CertificateRow): boolean => !row.hidden && !row.revokedAt;

/** Why this certificate cannot be revoked, or null when it can. */
export function revokeRefusal(row: CertificateRow): string | null {
  return row.revokedAt ? 'Certificate is already revoked' : null;
}

/**
 * Track ids a member completed that have no certificate yet: completions stored before
 * certificates existed, or an issue that failed. Revoked certificates count as issued,
 * so revoking is never undone by issuing again.
 */
export function missingTrackIds(completedTrackIds: string[], issuedTrackIds: string[]): string[] {
  const issued = new Set(issuedTrackIds);
  return [...new Set(completedTrackIds)].filter((id) => !issued.has(id));
}
