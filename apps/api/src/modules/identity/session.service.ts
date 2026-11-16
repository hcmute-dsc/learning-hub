import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { Role, UserStatus } from '@hub/shared';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { Clock } from '../../infrastructure/clock';
import { ENV, type Env } from '../../infrastructure/config/env';
import type { AuthUser } from '../../common/auth.decorators';

const ABSOLUTE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const IDLE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

/** Server-side sessions (SECURITY §1): random 256-bit token in the cookie, sha256 in the DB. */
@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** `__Host-` cookies need HTTPS, so development uses a plain name. */
  get cookieName(): string {
    return this.env.NODE_ENV === 'production' ? '__Host-sid' : 'sid';
  }

  get cookieOptions() {
    return {
      httpOnly: true,
      secure: this.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: ABSOLUTE_TTL_MS,
    };
  }

  async create(userId: string, meta: { userAgent?: string; ip?: string }): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const now = this.clock.now();
    await this.prisma.session.create({
      data: {
        id: hashToken(token),
        userId,
        expiresAt: new Date(now.getTime() + ABSOLUTE_TTL_MS),
        lastSeenAt: now,
        userAgent: meta.userAgent?.slice(0, 300),
        ip: meta.ip,
      },
    });
    return token;
  }

  /** Returns the user for a valid session, or null. Slides `last_seen_at` at most hourly. */
  async resolve(token: string | undefined): Promise<AuthUser | null> {
    if (!token) return null;
    const id = hashToken(token);
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: { user: { include: { roles: { include: { role: true } } } } },
    });
    if (!session) return null;
    const now = this.clock.now();
    const idleExpired = now.getTime() - session.lastSeenAt.getTime() > IDLE_TTL_MS;
    if (session.expiresAt <= now || idleExpired || session.user.deletedAt) {
      await this.prisma.session.delete({ where: { id } }).catch(() => undefined);
      return null;
    }
    if (now.getTime() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.prisma.session.update({ where: { id }, data: { lastSeenAt: now } });
    }
    return {
      id: session.user.id,
      githubLogin: session.user.githubLogin,
      status: session.user.status as UserStatus,
      roles: session.user.roles.map((r) => r.role.code as Role),
    };
  }

  async destroy(token: string | undefined): Promise<void> {
    if (!token) return;
    await this.prisma.session.deleteMany({ where: { id: hashToken(token) } });
  }

  async destroyAllForUser(userId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { userId } });
  }
}
