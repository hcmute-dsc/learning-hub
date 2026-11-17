import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { UserEvents, type UserSuspendedEvent } from '../users/users.events';
import { SessionService } from './session.service';

/**
 * Signs a suspended account out everywhere. Lives in identity because sessions belong
 * here, and users must not import identity (identity already depends on users).
 * If this fails the account is still locked out: SessionGuard refuses `suspended`
 * on every request, so the error is only logged.
 */
@Injectable()
export class SuspensionListener {
  private readonly logger = new Logger(SuspensionListener.name);

  constructor(private readonly sessions: SessionService) {}

  @OnEvent(UserEvents.Suspended)
  async onSuspended(e: UserSuspendedEvent): Promise<void> {
    try {
      await this.sessions.destroyAllForUser(e.userId);
    } catch (err) {
      this.logger.error({ err, userId: e.userId }, 'Failed to revoke sessions of suspended user');
    }
  }
}
