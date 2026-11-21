import { Module } from '@nestjs/common';
import { ENV, type Env } from '../infrastructure/config/env';
import {
  MAIL_SENDER,
  NoopMailSender,
  type MailSender,
} from '../modules/notifications/ports/mail-sender';
import {
  ALERT_CHANNEL,
  CLUB_CHANNEL,
  CLUB_POSTER,
  NoopChannel,
  NoopPoster,
  type NotificationChannel,
} from '../modules/notifications/ports/notification-channel';
import { DiscordWebhookChannel } from './discord/discord-webhook.channel';
import { SmtpMailSender } from './email/smtp-mail.sender';

function channel(url: string | undefined, name: string): NotificationChannel {
  return url ? new DiscordWebhookChannel(url, name) : new NoopChannel();
}

/** SMTP needs a host and a sender address; without both the digest is simply off. */
export function mailSender(env: Env): MailSender {
  if (!env.SMTP_HOST || !env.SMTP_FROM) return new NoopMailSender();
  return new SmtpMailSender({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
    from: env.SMTP_FROM,
  });
}

/**
 * Binds the notification ports from env: the two Discord webhooks and the SMTP sender
 * for the email digest. An empty setting binds a no-op, so local dev and tests send nothing.
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
    {
      // Same club webhook; embeds with explicit mentions for the weekly leaderboard (#76)
      provide: CLUB_POSTER,
      inject: [ENV],
      useFactory: (env: Env) =>
        env.DISCORD_WEBHOOK_URL
          ? new DiscordWebhookChannel(env.DISCORD_WEBHOOK_URL, 'club')
          : new NoopPoster(),
    },
    { provide: MAIL_SENDER, inject: [ENV], useFactory: mailSender },
  ],
  exports: [CLUB_CHANNEL, ALERT_CHANNEL, CLUB_POSTER, MAIL_SENDER],
})
export class NotificationChannelsModule {}
