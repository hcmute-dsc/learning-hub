import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Me, Role, UserStatus } from '@hub/shared';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { Clock } from '../../infrastructure/clock';
import { ENV, type Env } from '../../infrastructure/config/env';
import { newId } from '../../infrastructure/ids';
import { DomainError } from '../../common/errors';
import { ROLE_IDS } from './roles';
import { UserEvents } from './users.events';

export interface GithubSignIn {
  githubId: bigint;
  login: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  isOrgMember: boolean | null;
}

/**
 * Status of a brand-new account (CRITIQUE §3.2): org members, allowlisted logins
 * and the bootstrap admin start `active`; everyone else waits as `pending`.
 */
export function initialStatus(
  input: { login: string; isOrgMember: boolean | null },
  env: Pick<Env, 'ALLOWLIST_GITHUB_LOGINS' | 'BOOTSTRAP_ADMIN_GITHUB_LOGIN'>,
): UserStatus {
  const login = input.login.toLowerCase();
  if (input.isOrgMember === true) return 'active';
  if (env.ALLOWLIST_GITHUB_LOGINS.includes(login)) return 'active';
  if (env.BOOTSTRAP_ADMIN_GITHUB_LOGIN === login) return 'active';
  return 'pending';
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly events: EventEmitter2,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Create or refresh the user after a successful GitHub sign-in. */
  async upsertFromGithub(input: GithubSignIn): Promise<{ id: string; status: UserStatus }> {
    const now = this.clock.now();
    const existing = await this.prisma.user.findUnique({ where: { githubId: input.githubId } });
    if (existing) {
      const updated = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          githubLogin: input.login,
          avatarUrl: input.avatarUrl,
          email: existing.email ?? input.email,
          lastLoginAt: now,
          // an org member who was waiting is let in automatically
          ...(existing.status === 'pending' && input.isOrgMember ? { status: 'active' } : {}),
        },
      });
      return { id: updated.id, status: updated.status as UserStatus };
    }

    const status = initialStatus(input, this.env);
    const isBootstrapAdmin = this.env.BOOTSTRAP_ADMIN_GITHUB_LOGIN === input.login.toLowerCase();
    const roleCodes: Role[] = isBootstrapAdmin ? ['member', 'admin'] : ['member'];
    const user = await this.prisma.user.create({
      data: {
        id: newId(),
        githubId: input.githubId,
        githubLogin: input.login,
        displayName: input.name?.trim() || input.login,
        email: input.email,
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
    });
    return { id: user.id, status };
  }

  async getMe(userId: string): Promise<Me> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    if (!user || user.deletedAt) throw DomainError.notFound('User');
    return {
      id: user.id,
      githubLogin: user.githubLogin,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      status: user.status as UserStatus,
      roles: user.roles.map((r) => r.role.code as Role),
    };
  }

  async listPending(): Promise<Me[]> {
    const users = await this.prisma.user.findMany({
      where: { status: 'pending', deletedAt: null },
      include: { roles: { include: { role: true } } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return users.map((u) => ({
      id: u.id,
      githubLogin: u.githubLogin,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      status: u.status as UserStatus,
      roles: u.roles.map((r) => r.role.code as Role),
    }));
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
