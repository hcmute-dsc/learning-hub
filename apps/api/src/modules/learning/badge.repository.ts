import { Injectable } from '@nestjs/common';
import { badgeDefinition, type BadgeCode, type EarnedBadge } from '@hub/shared';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

/** The only code that reads or writes the `user_badges` table (DATABASE §3.17, F12). */
@Injectable()
export class BadgeRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The member's badges, oldest first. Codes no longer in BADGES are left out. */
  async listFor(userId: string): Promise<EarnedBadge[]> {
    const rows = await this.prisma.userBadge.findMany({
      where: { userId },
      orderBy: { awardedAt: 'asc' },
      select: { badge: true, awardedAt: true },
    });
    const badges: EarnedBadge[] = [];
    for (const row of rows) {
      const definition = badgeDefinition(row.badge);
      if (!definition) continue;
      badges.push({ code: definition.code, awardedAt: row.awardedAt.toISOString() });
    }
    return badges;
  }

  /**
   * Stores one badge. Idempotent on the (user, badge) key: returns false when the member
   * already had it, also when a parallel request stored it first, so only one caller
   * announces it.
   */
  async insert(userId: string, badge: BadgeCode, awardedAt: Date): Promise<boolean> {
    const { count } = await this.prisma.userBadge.createMany({
      data: [{ userId, badge, awardedAt }],
      skipDuplicates: true,
    });
    return count === 1;
  }
}
