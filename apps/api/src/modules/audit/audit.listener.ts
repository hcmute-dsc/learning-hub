import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
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

  @OnEvent(UserEvents.Registered, { async: true })
  onRegistered(e: { userId: string; status: string; roles: string[] }) {
    return this.write('user.register', 'user', e.userId, null, {
      status: e.status,
      roles: e.roles,
    });
  }

  @OnEvent(UserEvents.Approved, { async: true })
  onApproved(e: { actorId: string; userId: string }) {
    return this.write('user.approve', 'user', e.userId, e.actorId);
  }

  @OnEvent(UserEvents.RolesChanged, { async: true })
  onRolesChanged(e: { actorId: string; userId: string; roles: string[] }) {
    return this.write('role.set', 'user', e.userId, e.actorId, { roles: e.roles });
  }
}
