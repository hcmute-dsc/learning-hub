import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  CertificateEvents,
  type CertificateRevokedEvent,
} from '../certificates/certificates.events';
import { ContentEvents, type ContentVersionEvent } from '../content/content.events';
import {
  LeaderboardPostEvents,
  type LeaderboardPostEvent,
} from '../notifications/weekly-leaderboard/weekly-leaderboard.events';
import { ReviewEvents, type ReviewCompletedEvent } from '../reviews/reviews.events';
import {
  UserEvents,
  type DiscordLinkEvent,
  type RolesChangedEvent,
  type UserReactivatedEvent,
  type UserSuspendedEvent,
} from '../users/users.events';

/**
 * Writes audit_logs from domain events (SECURITY §11). Audit never calls other
 * modules; it only listens. Failures are logged and never break the request.
 */
@Injectable()
export class AuditListener {
  private readonly logger = new Logger(AuditListener.name);

  constructor(private readonly prisma: PrismaService) {}

  private async write(
    action: string,
    entityType: string,
    entityId: string,
    actorId: string | null,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: { action, entityType, entityId, actorId, metadata: metadata as object },
      });
    } catch (err) {
      this.logger.error({ err, action, entityId }, 'Failed to write audit log');
    }
  }

  @OnEvent(UserEvents.Registered)
  onRegistered(e: { userId: string; status: string; roles: string[]; reason?: string | null }) {
    return this.write('user.register', 'user', e.userId, null, {
      status: e.status,
      roles: e.roles,
      reason: e.reason ?? null,
    });
  }

  @OnEvent(UserEvents.Approved)
  onApproved(e: { actorId: string | null; userId: string; reason?: string }) {
    return this.write('user.approve', 'user', e.userId, e.actorId, {
      reason: e.reason ?? 'manual',
    });
  }

  /** Counts only: the list itself is personal data and stays out of the audit log. */
  @OnEvent(UserEvents.ApprovedEmailsChanged)
  onApprovedEmailsChanged(e: {
    actorId: string;
    mode: string;
    submitted: number;
    total: number;
    activated: number;
  }) {
    const { actorId, ...counts } = e;
    return this.write('approved_emails.update', 'approved_emails', 'list', actorId, counts);
  }

  @OnEvent(UserEvents.RolesChanged)
  onRolesChanged(e: RolesChangedEvent) {
    return this.write('role.set', 'user', e.userId, e.actorId, {
      roles: e.roles,
      previousRoles: e.previousRoles,
    });
  }

  @OnEvent(UserEvents.Suspended)
  onSuspended(e: UserSuspendedEvent) {
    return this.write('user.suspend', 'user', e.userId, e.actorId, {
      previousStatus: e.previousStatus,
    });
  }

  @OnEvent(UserEvents.Reactivated)
  onReactivated(e: UserReactivatedEvent) {
    return this.write('user.reactivate', 'user', e.userId, e.actorId);
  }

  /** The member themself links or unlinks Discord in /settings (learning-hub#76). */
  @OnEvent(UserEvents.DiscordLinked)
  onDiscordLinked(e: DiscordLinkEvent) {
    return this.write('user.discord_link', 'user', e.userId, e.userId, {
      discordUsername: e.discordUsername,
    });
  }

  /** An admin posted or edited the weekly leaderboard on Discord (learning-hub#83). */
  @OnEvent(LeaderboardPostEvents.Posted)
  onLeaderboardPosted(e: LeaderboardPostEvent) {
    return this.write('leaderboard.post', 'leaderboard_week', e.weekId, e.actorId, {
      members: e.members,
    });
  }

  @OnEvent(LeaderboardPostEvents.Updated)
  onLeaderboardUpdated(e: LeaderboardPostEvent) {
    return this.write('leaderboard.update', 'leaderboard_week', e.weekId, e.actorId, {
      members: e.members,
    });
  }

  @OnEvent(UserEvents.DiscordUnlinked)
  onDiscordUnlinked(e: DiscordLinkEvent) {
    return this.write('user.discord_unlink', 'user', e.userId, e.userId, {
      discordUsername: e.discordUsername,
    });
  }

  @OnEvent(ContentEvents.Synced)
  onContentSynced(e: ContentVersionEvent) {
    return this.write('content.sync', 'content_version', e.versionId, e.actorId, {
      commitSha: e.commitSha,
      status: e.status,
    });
  }

  @OnEvent(ContentEvents.Published)
  onContentPublished(e: ContentVersionEvent) {
    return this.write('content.publish', 'content_version', e.versionId, e.actorId, {
      commitSha: e.commitSha,
    });
  }

  @OnEvent(ContentEvents.Rejected)
  onContentRejected(e: ContentVersionEvent) {
    return this.write('content.reject', 'content_version', e.versionId, e.actorId, {
      commitSha: e.commitSha,
    });
  }

  @OnEvent(ReviewEvents.Completed)
  onReviewCompleted(e: ReviewCompletedEvent) {
    return this.write('review.complete', 'review', e.reviewId, e.reviewerId, {
      submissionId: e.submissionId,
      memberId: e.memberId,
      outcome: e.outcome,
    });
  }

  /** The reason is kept: admins need it later, and it names no personal data. */
  @OnEvent(CertificateEvents.Revoked)
  onCertificateRevoked(e: CertificateRevokedEvent) {
    return this.write('certificate.revoke', 'certificate', e.certificateId, e.actorId, {
      userId: e.userId,
      trackSlug: e.trackSlug,
      reason: e.reason,
    });
  }
}
