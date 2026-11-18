/** Domain events published by the certificates module (BACKEND-DESIGN §5). */
export const CertificateEvents = {
  /** a certificate was issued for a completed track (notifications may tell the member) */
  Issued: 'certificate.issued',
  /** an admin revoked a certificate; written to audit_logs */
  Revoked: 'certificate.revoked',
} as const;

export interface CertificateIssuedEvent {
  certificateId: string;
  code: string;
  userId: string;
  trackId: string;
}

export interface CertificateRevokedEvent {
  actorId: string;
  certificateId: string;
  userId: string;
  trackSlug: string;
  reason: string;
}
