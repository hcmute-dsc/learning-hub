import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ADMIN_USERS_LIMIT,
  type AdminUserRow,
  type Me,
  type Role,
  type Theme,
  type UserStatus,
} from '@hub/shared';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { Clock } from '../../infrastructure/clock';
import { ENV, type Env } from '../../infrastructure/config/env';
import { newId } from '../../infrastructure/ids';
import { DomainError } from '../../common/errors';
import { ROLE_IDS } from './roles';
import { approvalReason, type SignInFacts } from './approval';
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

  /** Replace a user's roles. Admins cannot remove their own admin role. */
  async setRoles(actorId: string, userId: string, roles: Role[]): Promise<void> {
    if (actorId === userId && !roles.includes('admin')) {
      throw DomainError.conflict('You cannot remove your own admin role');
    }
    const unique = [...new Set<Role>(['member', ...roles])];
    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId } }),
      this.prisma.userRole.createMany({
        data: unique.map((code) => ({ userId, roleId: ROLE_IDS[code], grantedBy: actorId })),
      }),
    ]);
    await this.events.emitAsync(UserEvents.RolesChanged, { actorId, userId, roles: unique });
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
