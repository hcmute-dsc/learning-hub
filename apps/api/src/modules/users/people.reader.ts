import { Injectable } from '@nestjs/common';
import type { PersonRef } from '@hub/shared';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

/**
 * Public name and avatar of many users at once, for pages that show who did what
 * (review queue, reviews). Other modules use this instead of reading `users` directly.
 * Deleted accounts are still returned: their past work keeps a name.
 */
@Injectable()
export class PeopleReader {
  constructor(private readonly prisma: PrismaService) {}

  async byIds(ids: string[]): Promise<Map<string, PersonRef>> {
    const unique = [...new Set(ids)];
    if (!unique.length) return new Map();
    const rows = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, githubLogin: true, displayName: true, avatarUrl: true },
    });
    return new Map(rows.map((r) => [r.id, r]));
  }
}
