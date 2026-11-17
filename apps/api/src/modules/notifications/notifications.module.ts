import { Module } from '@nestjs/common';
import { ERROR_REPORTER } from '../../common/error-reporter';
import { NotificationChannelsModule } from '../../integrations/notification-channels.module';
import { CatalogModule } from '../catalog/catalog.module';
import { UsersModule } from '../users/users.module';
import { ErrorAlerts } from './error-alerts.service';
import { NotificationsListener } from './notifications.listener';

/**
 * Discord notifications (E9) and server-error alerts (E11). Only listens to events
 * and to the exception filter; nothing else depends on it, so removing it is safe.
 */
@Module({
  imports: [NotificationChannelsModule, CatalogModule, UsersModule],
  providers: [
    NotificationsListener,
    ErrorAlerts,
    { provide: ERROR_REPORTER, useExisting: ErrorAlerts },
  ],
  exports: [ERROR_REPORTER],
})
export class NotificationsModule {}
