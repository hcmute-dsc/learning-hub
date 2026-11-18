import { Injectable } from '@nestjs/common';
import { isUniqueViolation } from '../../infrastructure/prisma/errors';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { CertificateRow } from './certificate-rules';

export type NewCertificate = Omit<
  CertificateRow,
  'issuedAt' | 'hidden' | 'revokedAt' | 'revokedBy' | 'revokeReason'
>;

/** `issued` or why the insert lost: the member already has one, or the code was taken. */
export type InsertResult =
  { kind: 'issued'; row: CertificateRow } | { kind: 'owner_taken' } | { kind: 'code_taken' };

/** The only code that reads or writes the `certificates` table (DATABASE §3.x). */
@Injectable()
export class CertificatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByCode(code: string): Promise<CertificateRow | null> {
    return this.prisma.certificate.findUnique({ where: { code } });
  }

  findFor(userId: string, trackId: string): Promise<CertificateRow | null> {
    return this.prisma.certificate.findUnique({ where: { userId_trackId: { userId, trackId } } });
  }

  /** The member's certificates, latest completion first. */
  listByUser(userId: string): Promise<CertificateRow[]> {
    return this.prisma.certificate.findMany({
      where: { userId },
      orderBy: { completedAt: 'desc' },
    });
  }

  listRecent(limit: number): Promise<CertificateRow[]> {
    return this.prisma.certificate.findMany({ orderBy: { issuedAt: 'desc' }, take: limit });
  }

  /**
   * Insert one certificate. The unique keys decide races: (user_id, track_id) makes
   * issuing idempotent, and a code collision (2^-120, but cheap to handle) is reported
   * so the caller can draw a new code.
   */
  async insert(data: NewCertificate): Promise<InsertResult> {
    try {
      return { kind: 'issued', row: await this.prisma.certificate.create({ data }) };
    } catch (error) {
      if (isUniqueViolation(error, 'code')) return { kind: 'code_taken' };
      if (isUniqueViolation(error)) return { kind: 'owner_taken' };
      throw error;
    }
  }

  /** Only the owner's row changes; null when the code is not theirs. */
  async setHidden(userId: string, code: string, hidden: boolean): Promise<CertificateRow | null> {
    const { count } = await this.prisma.certificate.updateMany({
      where: { code, userId },
      data: { hidden },
    });
    return count ? this.findByCode(code) : null;
  }

  /** Revoke once: false when it was revoked already (two admins at the same time). */
  async revoke(id: string, actorId: string, reason: string, at: Date): Promise<boolean> {
    const { count } = await this.prisma.certificate.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: at, revokedBy: actorId, revokeReason: reason },
    });
    return count === 1;
  }
}
