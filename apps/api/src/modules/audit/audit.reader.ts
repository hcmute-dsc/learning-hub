import { Injectable } from '@nestjs/common';
import type { AuditLogRow, AuditPage, AuditQuery } from '@hub/shared';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { safeMetadata, toPage } from './audit-page';

/**
 * Reads audit_logs for the admin "Nhật ký" page (SECURITY §11: admin only).
 * Names come from UsersService rather than a Prisma join on `users`, so the users
 * module stays the only code that reads its table (CONTRIBUTING rule 1). That is one
 * extra query per page of at most 100 rows.
 */
@Injectable()
export class AuditReader {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async list(query: AuditQuery): Promise<{ data: AuditLogRow[]; page: AuditPage }> {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        ...(query.action ? { action: query.action } : {}),
        ...(query.cursor ? { id: { lt: BigInt(query.cursor) } } : {}),
      },
      orderBy: { id: 'desc' },
      take: query.limit + 1,
    });
    const { items, nextCursor } = toPage(rows, query.limit);

    const userIds = items.flatMap((r) => [r.actorId, r.entityType === 'user' ? r.entityId : null]);
    const refs = await this.users.refsByIds(userIds);

    const data = items.map((r) => ({
      id: r.id.toString(),
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      actor: r.actorId ? (refs.get(r.actorId) ?? null) : null,
      target: r.entityType === 'user' ? (refs.get(r.entityId) ?? null) : null,
      metadata: safeMetadata(r.metadata),
      createdAt: r.createdAt.toISOString(),
    }));
    return { data, page: { nextCursor, limit: query.limit } };
  }

  /** Audit rows written at or after `since` (admin overview activity). */
  countSince(since: Date): Promise<number> {
    return this.prisma.auditLog.count({ where: { createdAt: { gte: since } } });
  }

  /** Every action code that occurs, for the filter. */
  async actions(): Promise<string[]> {
    const rows = await this.prisma.auditLog.findMany({
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
    });
    return rows.map((r) => r.action);
  }
}
