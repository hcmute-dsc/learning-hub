import { Module } from '@nestjs/common';
import { ENV, type Env } from '../infrastructure/config/env';
import {
  ALERT_CHANNEL,
  CLUB_CHANNEL,
  NoopChannel,
  type NotificationChannel,
} from '../modules/notifications/ports/notification-channel';
import { DiscordWebhookChannel } from './discord/discord-webhook.channel';

function channel(url: string | undefined, name: string): NotificationChannel {
  return url ? new DiscordWebhookChannel(url, name) : new NoopChannel();
}

/**
 * Binds the two NotificationChannel ports to Discord webhooks from env.
 * An empty URL binds a no-op channel, so local dev and tests send nothing.
 */
@Module({
  providers: [
    {
      provide: CLUB_CHANNEL,
      inject: [ENV],
      useFactory: (env: Env) => channel(env.DISCORD_WEBHOOK_URL, 'club'),
    },
    {
      provide: ALERT_CHANNEL,
      inject: [ENV],
      useFactory: (env: Env) => channel(env.DISCORD_ALERT_WEBHOOK_URL, 'alert'),
    },
  ],
  exports: [CLUB_CHANNEL, ALERT_CHANNEL],
})
export class NotificationChannelsModule {}
