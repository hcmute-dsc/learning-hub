import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomBytes } from 'node:crypto';
import {
  ADMIN_CERTIFICATES_LIMIT,
  type AdminCertificateRow,
  type CertificateView,
  type MyCertificate,
} from '@hub/shared';
import { DomainError } from '../../common/errors';
import { Clock } from '../../infrastructure/clock';
import { newId } from '../../infrastructure/ids';
import { CatalogReader } from '../catalog/catalog.reader';
import { CompletedTracksReader } from '../learning/completed-tracks.reader';
import { PeopleReader } from '../users/people.reader';
import { UsersService } from '../users/users.service';
import {
  CODE_BYTES,
  certificateCode,
  isCertificateCode,
  missingTrackIds,
  revokeRefusal,
  shownOnProfile,
  toAdminRow,
  toCertificateView,
  toMyCertificate,
  type CertificateRow,
} from './certificate-rules';
import {
  CertificateEvents,
  type CertificateIssuedEvent,
  type CertificateRevokedEvent,
} from './certificates.events';
import { CertificatesRepository } from './certificates.repository';

/** A new code is drawn when one is taken; three collisions in a row would mean a bug. */
const CODE_ATTEMPTS = 3;

/**
 * Track completion certificates (PRD F19). Issued when learning reports a completed
 * track (CertificatesListener), never decided here: the completion rule stays in
 * learning/progress.ts. Members verify, hide; admins revoke (audited through events).
 */
@Injectable()
export class CertificatesService {
  private readonly logger = new Logger(CertificatesService.name);

  constructor(
    private readonly certificates: CertificatesRepository,
    private readonly catalog: CatalogReader,
    private readonly completedTracks: CompletedTracksReader,
    private readonly people: PeopleReader,
    private readonly users: UsersService,
    private readonly clock: Clock,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Issue the member's certificate for a track, once. Calling it again (event replayed,
   * two requests at the same time) returns the certificate that exists, even a revoked
   * one: revoking is never undone by completing again.
   */
  async issue(userId: string, trackId: string, completedAt: Date): Promise<CertificateRow> {
    const existing = await this.certificates.findFor(userId, trackId);
    if (existing) return existing;

    const [track, people] = await Promise.all([
      this.catalog.trackSource(trackId),
      this.people.byIds([userId]),
    ]);
    const person = people.get(userId);
    if (!person) throw DomainError.notFound('User');

    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
      const result = await this.certificates.insert({
        id: newId(),
        code: this.newCode(),
        userId,
        trackId,
        recipientName: person.displayName,
        trackSlug: track.slug,
        trackTitle: track.title,
        contentRepo: track.source.repo,
        commitSha: track.source.commitSha.toLowerCase(),
        completedAt,
      });
      if (result.kind === 'issued') {
        const event: CertificateIssuedEvent = {
          certificateId: result.row.id,
          code: result.row.code,
          userId,
          trackId,
        };
        await this.events.emitAsync(CertificateEvents.Issued, event);
        return result.row;
      }
      if (result.kind === 'owner_taken') {
        const winner = await this.certificates.findFor(userId, trackId);
        if (winner) return winner;
      }
    }
    throw DomainError.conflict('Could not issue the certificate, please retry');
  }

  /**
   * Catch up on completions with no certificate: tracks completed before certificates
   * existed, or an issue that failed in the listener. One failing track does not stop
   * the others, and never fails the page that asked.
   */
  async issueMissing(userId: string): Promise<void> {
    const [completed, issued] = await Promise.all([
      this.completedTracks.forUser(userId),
      this.certificates.listByUser(userId),
    ]);
    const missing = missingTrackIds(
      completed.map((c) => c.trackId),
      issued.map((c) => c.trackId),
    );
    for (const trackId of missing) {
      const completedAt = completed.find((c) => c.trackId === trackId)?.completedAt;
      if (!completedAt) continue;
      try {
        await this.issue(userId, trackId, completedAt);
      } catch (err) {
        this.logger.error({ err, userId, trackId }, 'Failed to issue a missing certificate');
      }
    }
  }

  /** GET /certificates/:code, public. Revoked ones still answer, marked revoked. */
  async verify(code: string): Promise<CertificateView> {
    return toCertificateView(await this.byCode(code));
  }

  /** GET /me/certificates: every certificate of the member, hidden and revoked included. */
  async listMine(userId: string): Promise<MyCertificate[]> {
    await this.issueMissing(userId);
    return (await this.certificates.listByUser(userId)).map(toMyCertificate);
  }

  /** PATCH /me/certificates/:code. Someone else's code is a 404, like a missing one. */
  async setHidden(userId: string, code: string, hidden: boolean): Promise<MyCertificate> {
    if (!isCertificateCode(code)) throw DomainError.notFound('Certificate');
    const row = await this.certificates.setHidden(userId, code, hidden);
    if (!row) throw DomainError.notFound('Certificate');
    return toMyCertificate(row);
  }

  /** GET /members/:login/certificates: what the profile shows (not hidden, not revoked). */
  async forProfile(viewerId: string, login: string): Promise<CertificateView[]> {
    const user = await this.users.findActiveByLogin(login);
    if (!user) throw DomainError.notFound('Member');
    // The owner's own visit also catches up on older completions.
    if (user.id === viewerId) await this.issueMissing(user.id);
    const rows = await this.certificates.listByUser(user.id);
    return rows.filter(shownOnProfile).map(toCertificateView);
  }

  /** GET /admin/certificates: newest first, with the member's login. */
  async listForAdmin(): Promise<AdminCertificateRow[]> {
    const rows = await this.certificates.listRecent(ADMIN_CERTIFICATES_LIMIT);
    const people = await this.people.byIds(rows.map((r) => r.userId));
    return rows.map((r) => toAdminRow(r, people.get(r.userId)?.githubLogin ?? ''));
  }

  /** POST /admin/certificates/:code/revoke. Audited through CertificateEvents.Revoked. */
  async revoke(actorId: string, code: string, reason: string): Promise<AdminCertificateRow> {
    const row = await this.byCode(code);
    const refusal = revokeRefusal(row);
    if (refusal) throw DomainError.conflict(refusal);
    const revoked = await this.certificates.revoke(row.id, actorId, reason, this.clock.now());
    if (!revoked) throw DomainError.conflict('Certificate is already revoked');

    const event: CertificateRevokedEvent = {
      actorId,
      certificateId: row.id,
      userId: row.userId,
      trackSlug: row.trackSlug,
      reason,
    };
    await this.events.emitAsync(CertificateEvents.Revoked, event);

    const updated = await this.byCode(code);
    const people = await this.people.byIds([updated.userId]);
    return toAdminRow(updated, people.get(updated.userId)?.githubLogin ?? '');
  }

  private async byCode(code: string): Promise<CertificateRow> {
    if (!isCertificateCode(code)) throw DomainError.notFound('Certificate');
    const row = await this.certificates.findByCode(code);
    if (!row) throw DomainError.notFound('Certificate');
    return row;
  }

  /** Separate method so tests can force a code collision. */
  protected newCode(): string {
    return certificateCode(randomBytes(CODE_BYTES));
  }
}
