import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { DiscordLink } from '@hub/shared';
import { DomainError } from '../../common/errors';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  DISCORD_ACCOUNT_PROVIDER,
  DISCORD_ID_PATTERN,
  type DiscordAccount,
  type DiscordAccountProvider,
} from './ports/discord-account';
import { UserEvents, type DiscordLinkEvent } from './users.events';

/**
 * Link and unlink a member's Discord account (learning-hub#76). The link is only used
 * to mention the member in the weekly leaderboard post; it never puts anyone on the
 * board (that is `leaderboard_opt_in`, ADR-08). Both changes are written to the audit
 * log through UserEvents (AuditListener).
 */
@Injectable()
export class DiscordLinkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    @Inject(DISCORD_ACCOUNT_PROVIDER) private readonly provider: DiscordAccountProvider,
  ) {}

  get available(): boolean {
    return this.provider.enabled;
  }

  async status(userId: string): Promise<DiscordLink> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { discordUsername: true, discordUserId: true },
    });
    return {
      available: this.provider.enabled,
      username: user?.discordUserId ? (user.discordUsername ?? user.discordUserId) : null,
    };
  }

  /**
   * Store the account. One Discord account belongs to one member: linking an account
   * that another member holds is refused (`CONFLICT`), never moved silently.
   */
  async link(userId: string, account: DiscordAccount): Promise<void> {
    if (!DISCORD_ID_PATTERN.test(account.id)) throw DomainError.conflict('Invalid Discord id');
    const holder = await this.prisma.user.findUnique({
      where: { discordUserId: account.id },
      select: { id: true },
    });
    if (holder && holder.id !== userId) {
      throw DomainError.conflict('This Discord account is linked to another member');
    }
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { discordUserId: account.id, discordUsername: account.username },
      });
    } catch (err) {
      // P2002: another member linked the same account between the read and the write.
      if ((err as { code?: unknown }).code === 'P2002') {
        throw DomainError.conflict('This Discord account is linked to another member');
      }
      throw err;
    }
    const event: DiscordLinkEvent = { userId, discordUsername: account.username };
    await this.events.emitAsync(UserEvents.DiscordLinked, event);
  }

  /** Forget the account. Unlinking twice is fine and writes no second audit row. */
  async unlink(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { discordUserId: true, discordUsername: true },
    });
    if (!user?.discordUserId) return;
    await this.prisma.user.update({
      where: { id: userId },
      data: { discordUserId: null, discordUsername: null },
    });
    const event: DiscordLinkEvent = {
      userId,
      discordUsername: user.discordUsername ?? user.discordUserId,
    };
    await this.events.emitAsync(UserEvents.DiscordUnlinked, event);
  }

  authorizeUrl(state: string, redirectUri: string): string {
    if (!this.provider.enabled) throw DomainError.notFound('Discord linking');
    return this.provider.authorizeUrl({ state, redirectUri });
  }

  /** Callback: read the account from Discord, then link it. */
  async complete(userId: string, code: string, redirectUri: string): Promise<void> {
    const account = await this.provider.fetchAccount({ code, redirectUri });
    await this.link(userId, account);
  }

  /**
   * Discord ids of these members, for mentions in the weekly post. Members without a
   * link are simply missing from the map.
   */
  async discordIdsOf(userIds: string[]): Promise<Map<string, string>> {
    if (!userIds.length) return new Map();
    const rows = await this.prisma.user.findMany({
      where: { id: { in: userIds }, discordUserId: { not: null } },
      select: { id: true, discordUserId: true },
    });
    return new Map(rows.flatMap((r) => (r.discordUserId ? [[r.id, r.discordUserId]] : [])));
  }
}
