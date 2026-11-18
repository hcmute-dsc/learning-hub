import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ADMIN_USERS_LIMIT,
  type AdminUserRow,
  type Me,
  type Role,
  type Theme,
  type UserRef,
  type UserStatus,
} from '@hub/shared';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { Clock } from '../../infrastructure/clock';
import { ENV, type Env } from '../../infrastructure/config/env';
import { newId } from '../../infrastructure/ids';
import { DomainError } from '../../common/errors';
import { ROLE_IDS } from './roles';
import { approvalReason, type SignInFacts } from './approval';
import { reactivateRefusal, roleChangeRefusal, suspendRefusal } from './account-rules';
import { UserEvents } from './users.events';

export interface GithubSignIn extends SignInFacts {
  githubId: bigint;
  name: string | null;
  /** primary verified email */
  email: string | null;
  avatarUrl: string | null;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly events: EventEmitter2,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * Create or refresh the user after a successful GitHub sign-in.
   * New accounts (and accounts still `pending`) become `active` when the approval
   * rule says so; otherwise they wait for an admin/mentor (USER-FLOWS §1).
   */
  async upsertFromGithub(input: GithubSignIn): Promise<{ id: string; status: UserStatus }> {
    const now = this.clock.now();
    const approvedMatch = await this.findApprovedEmail(input.verifiedEmails);
    const reason = approvalReason(
      input,
      (email) => email === approvedMatch,
      this.env.BOOTSTRAP_ADMIN_GITHUB_LOGIN,
    );
    // Keep the email that matched the club list, so later list updates find this user.
    const email = approvedMatch ?? input.email;

    const existing = await this.prisma.user.findUnique({ where: { githubId: input.githubId } });
    if (existing) {
      const becomesActive = existing.status === 'pending' && reason !== null;
      const updated = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          githubLogin: input.login,
          avatarUrl: input.avatarUrl,
          email: approvedMatch ?? existing.email ?? input.email,
          lastLoginAt: now,
          ...(becomesActive ? { status: 'active' } : {}),
        },
      });
      if (becomesActive) {
        await this.events.emitAsync(UserEvents.Approved, {
          actorId: null,
          userId: existing.id,
          reason,
        });
      }
      return { id: updated.id, status: updated.status as UserStatus };
    }

    const status: UserStatus = reason ? 'active' : 'pending';
    const roleCodes: Role[] = reason === 'bootstrap_admin' ? ['member', 'admin'] : ['member'];
    const user = await this.prisma.user.create({
      data: {
        id: newId(),
        githubId: input.githubId,
        githubLogin: input.login,
        displayName: input.name?.trim() || input.login,
        email,
        avatarUrl: input.avatarUrl,
        status,
        lastLoginAt: now,
        roles: { create: roleCodes.map((code) => ({ roleId: ROLE_IDS[code] })) },
      },
    });
    await this.events.emitAsync(UserEvents.Registered, {
      userId: user.id,
      status,
      roles: roleCodes,
      reason,
    });
    return { id: user.id, status };
  }

  /** The first of these emails that is on the club's approved list, or null. */
  private async findApprovedEmail(emails: string[]): Promise<string | null> {
    if (!emails.length) return null;
    const match = await this.prisma.approvedEmail.findFirst({
      where: { email: { in: emails } },
      select: { email: true },
    });
    return match?.email ?? null;
  }

  async getMe(userId: string): Promise<Me> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    if (!user || user.deletedAt) throw DomainError.notFound('User');
    return toMe(user);
  }

  /** Name and bio on the member's own profile (/settings). GitHub sign-in never overwrites them. */
  async updateProfile(userId: string, input: { displayName: string; bio: string | null }) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { displayName: input.displayName, bio: input.bio },
    });
    return this.getMe(userId);
  }

  async updateSettings(userId: string, input: { theme: Theme }) {
    await this.prisma.user.update({ where: { id: userId }, data: { theme: input.theme } });
    return this.getMe(userId);
  }

  /**
   * Profile owner for /members/:login: approved, not deleted. A login can repeat when
   * someone renamed their GitHub account and another person took the old name, so the
   * most recently signed-in account wins (only that one can hold the name today).
   */
  async findActiveByLogin(login: string): Promise<(Me & { createdAt: Date }) | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        githubLogin: { equals: login, mode: 'insensitive' },
        status: 'active',
        deletedAt: null,
      },
      include: { roles: { include: { role: true } } },
      orderBy: { lastLoginAt: { sort: 'desc', nulls: 'last' } },
    });
    return user ? { ...toMe(user), createdAt: user.createdAt } : null;
  }

  /**
   * Every account for the admin table (admin only: contains emails, SECURITY §1).
   * Pending first, then newest. `onEmailList` tells whether the account's email is on
   * the club list, so the admin sees why an account is (not) approved.
   */
  async listAllForAdmin(): Promise<AdminUserRow[]> {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      include: { roles: { include: { role: true } } },
      orderBy: { createdAt: 'desc' },
      take: ADMIN_USERS_LIMIT,
    });
    const emails = users.map((u) => u.email).filter((e): e is string => !!e);
    const listed = new Set(
      (
        await this.prisma.approvedEmail.findMany({
          where: { email: { in: emails } },
          select: { email: true },
        })
      ).map((r) => r.email),
    );
    const rows = users.map((u) => ({
      id: u.id,
      githubLogin: u.githubLogin,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      email: u.email,
      status: u.status as UserStatus,
      roles: u.roles.map((r) => r.role.code as Role),
      onEmailList: !!u.email && listed.has(u.email),
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    }));
    // Stable sort: pending accounts on top, each group stays newest first.
    return rows.sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending'));
  }

  /** Accounts per status for the admin overview (counts only, SECURITY §1). */
  async countByStatus(): Promise<Record<UserStatus, number>> {
    const groups = await this.prisma.user.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: { _all: true },
    });
    const counts: Record<UserStatus, number> = { pending: 0, active: 0, suspended: 0 };
    for (const g of groups) {
      if (g.status in counts) counts[g.status as UserStatus] = g._count._all;
    }
    return counts;
  }

  /** Accounts that signed in at or after `since` (admin overview activity). */
  countSignedInSince(since: Date): Promise<number> {
    return this.prisma.user.count({ where: { deletedAt: null, lastLoginAt: { gte: since } } });
  }

  async listPending(): Promise<Me[]> {
    const users = await this.prisma.user.findMany({
      where: { status: 'pending', deletedAt: null },
      include: { roles: { include: { role: true } } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return users.map(toMe);
  }

  async approve(actorId: string, userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw DomainError.notFound('User');
    if (user.status !== 'pending') throw DomainError.conflict('User is not pending');
    await this.prisma.user.update({ where: { id: userId }, data: { status: 'active' } });
    await this.events.emitAsync(UserEvents.Approved, { actorId, userId });
  }

  /**
   * Replace a user's roles (rules in account-rules.ts). The admin count is read in the
   * same transaction as the write, so two admins demoting each other at once cannot
   * both succeed and leave the club without an admin.
   */
  async setRoles(actorId: string, userId: string, roles: Role[]): Promise<void> {
    const unique = [...new Set<Role>(['member', ...roles])];
    const previous = await this.prisma
      .$transaction(
        async (tx) => {
          const user = await tx.user.findUnique({
            where: { id: userId },
            include: { roles: { include: { role: true } } },
          });
          if (!user || user.deletedAt) throw DomainError.notFound('User');
          const currentRoles = user.roles.map((r) => r.role.code as Role);
          const activeAdminCount = await tx.user.count({
            where: {
              status: 'active',
              deletedAt: null,
              roles: { some: { roleId: ROLE_IDS.admin } },
            },
          });
          const refusal = roleChangeRefusal({
            actorId,
            targetId: userId,
            currentRoles,
            nextRoles: unique,
            activeAdminCount,
          });
          if (refusal) throw DomainError.conflict(refusal);

          await tx.userRole.deleteMany({ where: { userId } });
          await tx.userRole.createMany({
            data: unique.map((code) => ({ userId, roleId: ROLE_IDS[code], grantedBy: actorId })),
          });
          return currentRoles;
        },
        { isolationLevel: 'Serializable' },
      )
      .catch((err: unknown) => {
        // P2034 = Postgres refused one of two concurrent serializable transactions.
        if ((err as { code?: unknown }).code === 'P2034') {
          throw DomainError.conflict('Roles changed at the same time, reload and try again');
        }
        throw err;
      });
    await this.events.emitAsync(UserEvents.RolesChanged, {
      actorId,
      userId,
      roles: unique,
      previousRoles: previous,
    });
  }

  /**
   * Block an account (spam, a member who left…). The session guard refuses suspended
   * accounts on every request; the identity module also deletes their sessions when it
   * hears UserEvents.Suspended, so nothing stays signed in (SECURITY §2).
   */
  async suspend(actorId: string, userId: string): Promise<void> {
    const user = await this.findLiveUser(userId);
    const refusal = suspendRefusal({
      actorId,
      targetId: userId,
      targetStatus: user.status as UserStatus,
    });
    if (refusal) throw DomainError.conflict(refusal);
    // `where.status` guards against a concurrent change between the read and the write.
    const { count } = await this.prisma.user.updateMany({
      where: { id: userId, status: user.status },
      data: { status: 'suspended' },
    });
    if (!count) throw DomainError.conflict('The account changed meanwhile, reload and try again');
    await this.events.emitAsync(UserEvents.Suspended, {
      actorId,
      userId,
      previousStatus: user.status,
    });
  }

  async reactivate(actorId: string, userId: string): Promise<void> {
    const user = await this.findLiveUser(userId);
    const refusal = reactivateRefusal(user.status as UserStatus);
    if (refusal) throw DomainError.conflict(refusal);
    const { count } = await this.prisma.user.updateMany({
      where: { id: userId, status: 'suspended' },
      data: { status: 'active' },
    });
    if (!count) throw DomainError.conflict('The account changed meanwhile, reload and try again');
    await this.events.emitAsync(UserEvents.Reactivated, { actorId, userId });
  }

  private async findLiveUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw DomainError.notFound('User');
    return user;
  }

  /**
   * Public name and avatar of these accounts (never the email), for other modules that
   * show "who did it" (content versions, audit log). Deleted accounts are still listed:
   * their past actions must stay readable.
   */
  async refsByIds(ids: (string | null)[]): Promise<Map<string, UserRef>> {
    const unique = [...new Set(ids.filter((id): id is string => !!id))];
    if (!unique.length) return new Map();
    const users = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, githubLogin: true, displayName: true, avatarUrl: true },
    });
    return new Map(users.map((u) => [u.id, u]));
  }
}

type UserWithRoles = {
  id: string;
  githubLogin: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  theme: string;
  status: string;
  roles: { role: { code: string } }[];
};

function toMe(user: UserWithRoles): Me {
  return {
    id: user.id,
    githubLogin: user.githubLogin,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    status: user.status as UserStatus,
    roles: user.roles.map((r) => r.role.code as Role),
    bio: user.bio,
    theme: user.theme as Theme,
  };
}
