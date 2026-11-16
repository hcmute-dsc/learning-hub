import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ContentEvents, type ContentVersionEvent } from '../content/content.events';
import { UserEvents } from '../users/users.events';

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
  onRolesChanged(e: { actorId: string; userId: string; roles: string[] }) {
    return this.write('role.set', 'user', e.userId, e.actorId, { roles: e.roles });
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
}
