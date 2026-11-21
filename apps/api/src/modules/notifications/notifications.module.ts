import { Module } from '@nestjs/common';
import { ERROR_REPORTER } from '../../common/error-reporter';
import { NotificationChannelsModule } from '../../integrations/notification-channels.module';
import { CatalogModule } from '../catalog/catalog.module';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { UsersModule } from '../users/users.module';
import { DigestService } from './digest/digest.service';
import { ErrorAlerts } from './error-alerts.service';
import { InboxController, UnsubscribeController } from './inbox/inbox.controller';
import { InboxListener } from './inbox/inbox.listener';
import { InboxService } from './inbox/inbox.service';
import { NotificationsListener } from './notifications.listener';
import { NotificationDispatcher } from './outbox/notification-dispatcher';
import { OutboxWorker } from './outbox/outbox.worker';
import { WeeklyLeaderboardService } from './weekly-leaderboard/weekly-leaderboard.service';

/**
 * Discord notifications (E9), server-error alerts (E11), and since learning-hub#49 the
 * in-app bell and the email digest. Other modules only reach it through domain events
 * and the exception filter; nothing else depends on it.
 *
 *   domain event → InboxListener → outbox_events → OutboxWorker → NotificationDispatcher
 *                                                    → notifications rows / SMTP digest
 *
 * Weekly leaderboard post (learning-hub#76): the worker's housekeeping asks
 * WeeklyLeaderboardService, which reads LeaderboardService and queues one outbox row per
 * week (`leaderboard-week:<YYYY-Www>`); the dispatcher posts it through CLUB_POSTER.
 */
@Module({
  imports: [NotificationChannelsModule, CatalogModule, UsersModule, LeaderboardModule],
  controllers: [InboxController, UnsubscribeController],
  providers: [
    NotificationsListener,
    ErrorAlerts,
    { provide: ERROR_REPORTER, useExisting: ErrorAlerts },
    InboxListener,
    InboxService,
    DigestService,
    NotificationDispatcher,
    OutboxWorker,
    WeeklyLeaderboardService,
  ],
  exports: [ERROR_REPORTER],
})
export class NotificationsModule {}
